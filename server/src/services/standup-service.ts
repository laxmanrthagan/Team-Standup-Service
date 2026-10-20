import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { isWritableTeamDate, previousWorkingDay, teamDateAt } from '../../../shared/dates.js';
import { standupCreateSchema, standupUpdateSchema, type StandupCreateInput, type StandupUpdateInput } from '../../../shared/validation.js';
import { StandupRepository } from '../repositories/standup-repository.js';
import { ServiceError } from './errors.js';

export class StandupService {
  private readonly repository: StandupRepository;
  constructor(private readonly db: Database.Database, private readonly now: () => Date = () => new Date()) { this.repository = new StandupRepository(db); }
  members() { return this.repository.members(); }
  list(teamDate?: string, memberId?: string) { return this.repository.list(teamDate, memberId); }
  get(id: string) { return this.repository.findById(id); }
  history(teamDate: string, memberId?: string) { return { teamDate, standups: this.repository.list(teamDate, memberId) }; }
  historyRange(from: string, to: string, memberId?: string) { return { from, to, standups: this.repository.listRange(from, to, memberId) }; }
  dashboard(date = teamDateAt(this.now())) {
    if (!isWritableTeamDate(date, teamDateAt(this.now()))) throw new ServiceError(400, 'INVALID_TEAM_DATE', 'Dashboard date must be today or the previous working day.');
    const today = teamDateAt(this.now());
    const dates = [...new Set([today, previousWorkingDay(today)])];
    const active = this.repository.members(true);
    return { teamDate: today, previousWorkingDay: previousWorkingDay(today), requestedDate: date, panels: dates.map((teamDate) => {
      const records = this.repository.list(teamDate, undefined, false);
      const submitted = new Set(records.map(({ memberId }) => memberId));
      return { teamDate, submittedMembers: records, missingMembers: active.filter(({ id }) => !submitted.has(id)) };
    }) };
  }
  create(input: unknown) {
    const parsed = standupCreateSchema.safeParse(input);
    if (!parsed.success) throw new ServiceError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid standup.');
    return this.createValidated(parsed.data, true);
  }
  createValidated(input: StandupCreateInput, enforceWindow: boolean) {
    if (enforceWindow && !isWritableTeamDate(input.teamDate, teamDateAt(this.now()))) throw new ServiceError(400, 'INVALID_TEAM_DATE', 'Writes are accepted only for today or the previous working day.');
    const member = this.repository.members().find(({ id }) => id === input.memberId);
    if (!member || !member.active) throw new ServiceError(404, 'MEMBER_NOT_FOUND', 'Active member was not found.');
    if (this.repository.findByMemberDate(input.memberId, input.teamDate)) throw new ServiceError(409, 'STANDUP_EXISTS', 'A standup already exists for this member and date.');
    const timestamp = this.now().toISOString();
    const id = randomUUID();
    try {
      this.db.prepare('INSERT INTO standups(id,member_id,team_date,tasks_json,blockers,created_at_utc,updated_at_utc) VALUES(?,?,?,?,?,?,?)').run(id, input.memberId, input.teamDate, JSON.stringify(input.tasks), input.blockers, timestamp, timestamp);
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE')) throw new ServiceError(409, 'STANDUP_EXISTS', 'A standup already exists for this member and date.');
      throw error;
    }
    return this.repository.findById(id)!;
  }
  update(id: string, input: unknown) {
    const parsed = standupUpdateSchema.safeParse(input);
    if (!parsed.success) throw new ServiceError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid standup.');
    const record = this.repository.findById(id);
    if (!record) throw new ServiceError(404, 'STANDUP_NOT_FOUND', 'Standup was not found.');
    if (!record.active) throw new ServiceError(404, 'MEMBER_NOT_FOUND', 'Active member was not found.');
    if (!isWritableTeamDate(record.teamDate, teamDateAt(this.now()))) throw new ServiceError(400, 'INVALID_TEAM_DATE', 'Writes are accepted only for today or the previous working day.');
    const value: StandupUpdateInput = parsed.data;
    const timestamp = this.now().toISOString();
    const update = this.db.transaction(() => {
      this.db.prepare('UPDATE standups SET tasks_json=?, blockers=?, updated_at_utc=? WHERE id=?').run(JSON.stringify(value.tasks), value.blockers, timestamp, id);
      this.db.prepare('INSERT INTO audit_events(id,standup_id,event_type,timestamp_utc,previous_value_json,new_value_json) VALUES(?,?,?,?,?,?)').run(randomUUID(), id, 'updated', timestamp, JSON.stringify({ tasks: record.tasks, blockers: record.blockers }), JSON.stringify(value));
    });
    update();
    return this.repository.findById(id)!;
  }
}
