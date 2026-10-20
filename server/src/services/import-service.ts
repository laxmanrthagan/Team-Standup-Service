import { createHash, randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { previousWorkingDay } from '../../../shared/dates.js';
import { standupCreateSchema, teamDateSchema, type StandupCreateInput } from '../../../shared/validation.js';
import { StandupService } from './standup-service.js';

interface ImportRow { index: number; teamDate?: string; input?: StandupCreateInput; reason?: string; duplicate?: boolean }
export interface ImportReport { jobId: string | null; status: 'imported' | 'already_imported'; total: number; standupCandidates: number; imported: number; skipped: number; rejected: number; rows: Array<{ index: number; teamDate?: string; status: 'imported' | 'skipped' | 'rejected'; reason?: string }> }

export class ImportService {
  constructor(private readonly db: Database.Database, private readonly standups: StandupService) {}
  importJson(fileName: string, raw: string): ImportReport {
    const hash = createHash('sha256').update(raw).digest('hex');
    const previous = this.db.prepare('SELECT id,report_json FROM import_jobs WHERE file_sha256=?').get(hash) as { id: string; report_json: string } | undefined;
    if (previous) return { ...(JSON.parse(previous.report_json) as ImportReport), jobId: previous.id, status: 'already_imported' };
    const root: unknown = JSON.parse(raw);
    if (!root || typeof root !== 'object' || Array.isArray(root)) throw new Error('Import must be a JSON object.');
    const legacy = root as { version?: unknown; standups?: unknown };
    if (legacy.version !== 1 || !Array.isArray(legacy.standups)) throw new Error('Expected v1 JSON with version: 1 and a standups array.');
    const members = this.standups.members();
    const names = new Map(members.map(({ displayName, id }) => [displayName.toLocaleLowerCase().trim(), id]));
    const seen = new Set<string>();
    const rows: ImportRow[] = legacy.standups.flatMap((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return [{ index, reason: 'Record must be an object.' }];
      const old = item as Record<string, unknown>;
      const memberId = typeof old.memberId === 'string' ? old.memberId : typeof old.memberName === 'string' ? names.get(old.memberName.toLocaleLowerCase().trim()) : undefined;
      if (!memberId && typeof old.memberName === 'string') return [{ index, reason: 'Unknown member name.' }];
      const recordDate = old.teamDate ?? old.date;
      const hasSplitV1Fields = !Object.hasOwn(old, 'tasks') && (Object.hasOwn(old, 'today') || Object.hasOwn(old, 'yesterday'));
      const candidates: Array<{ teamDate: unknown; tasks: unknown; blockers: unknown }> = [];
      if (hasSplitV1Fields) {
        const validDate = teamDateSchema.safeParse(recordDate);
        if (!validDate.success) return [{ index, reason: 'Legacy date must be a valid YYYY-MM-DD calendar date.' }];
        if (Object.hasOwn(old, 'today')) candidates.push({ teamDate: recordDate, tasks: old.today, blockers: old.blockers ?? old.blocker ?? '' });
        if (Object.hasOwn(old, 'yesterday')) candidates.push({ teamDate: previousWorkingDay(validDate.data), tasks: old.yesterday, blockers: old.yesterdayBlockers ?? '' });
      } else {
        candidates.push({ teamDate: recordDate, tasks: old.tasks, blockers: old.blockers ?? old.blocker ?? '' });
      }
      if (!candidates.length) return [{ index, reason: 'Record is missing tasks or legacy today/yesterday fields.' }];
      return candidates.map(({ teamDate, tasks, blockers }): ImportRow => {
        if (typeof tasks === 'string') tasks = tasks.split(/\r?\n/u).map((task) => task.replace(/^\s*(?:[-*•]|\d+[.)])\s*/u, '').trim()).filter(Boolean);
        const parsed = standupCreateSchema.safeParse({ memberId, teamDate, tasks, blockers });
        if (!parsed.success) return { index, ...(typeof teamDate === 'string' ? { teamDate } : {}), reason: parsed.error.issues[0]?.message ?? 'Invalid record.' };
        if (!members.some((member) => member.id === parsed.data.memberId && member.active)) return { index, teamDate: parsed.data.teamDate, reason: 'Unknown or inactive member.' };
        const key = `${parsed.data.memberId}\u0000${parsed.data.teamDate}`;
        if (seen.has(key)) return { index, teamDate: parsed.data.teamDate, input: parsed.data, duplicate: true };
        seen.add(key);
        return { index, teamDate: parsed.data.teamDate, input: parsed.data, duplicate: false };
      });
    });
    const report: ImportReport = { jobId: null, status: 'imported', total: legacy.standups.length, standupCandidates: rows.length, imported: 0, skipped: 0, rejected: 0, rows: [] };
    const jobId = randomUUID();
    const timestamp = new Date().toISOString();
    const transaction = this.db.transaction(() => {
      for (const row of rows) {
        if (row.reason) { report.rejected++; report.rows.push({ index: row.index, ...(row.teamDate ? { teamDate: row.teamDate } : {}), status: 'rejected', reason: row.reason }); continue; }
        const input = row.input!;
        if (row.duplicate) { report.skipped++; report.rows.push({ index: row.index, teamDate: input.teamDate, status: 'skipped', reason: 'Duplicate member and team date within file; first valid record wins.' }); continue; }
        if (this.db.prepare('SELECT 1 FROM standups WHERE member_id=? AND team_date=?').get(input.memberId, input.teamDate)) { report.skipped++; report.rows.push({ index: row.index, teamDate: input.teamDate, status: 'skipped', reason: 'Record already exists in database.' }); continue; }
        this.standups.createValidated(input, false);
        report.imported++;
        report.rows.push({ index: row.index, teamDate: input.teamDate, status: 'imported' });
      }
      report.jobId = jobId;
      this.db.prepare('INSERT INTO import_jobs(id,file_name,file_sha256,imported_at_utc,status,report_json) VALUES(?,?,?,?,?,?)').run(jobId, fileName, hash, timestamp, 'completed', JSON.stringify(report));
    });
    transaction();
    return report;
  }
}
