import type Database from 'better-sqlite3';

export interface StandupRecord {
  id: string;
  memberId: string;
  displayName: string;
  active: boolean;
  teamDate: string;
  tasks: string[];
  blockers: string;
  createdAtUtc: string;
  updatedAtUtc: string;
}

type Row = { id: string; member_id: string; display_name: string; active: number; team_date: string; tasks_json: string; blockers: string; created_at_utc: string; updated_at_utc: string };
const mapRow = (row: Row): StandupRecord => ({ id: row.id, memberId: row.member_id, displayName: row.display_name, active: row.active === 1, teamDate: row.team_date, tasks: JSON.parse(row.tasks_json) as string[], blockers: row.blockers, createdAtUtc: row.created_at_utc, updatedAtUtc: row.updated_at_utc });

export class StandupRepository {
  constructor(private readonly db: Database.Database) {}
  members(activeOnly = false): Array<{ id: string; displayName: string; role: 'member' | 'lead' | 'support'; active: boolean }> {
    const rows = this.db.prepare(`SELECT id, display_name, role, active FROM members ${activeOnly ? 'WHERE active = 1' : ''} ORDER BY display_name COLLATE NOCASE, id`).all() as Array<{ id: string; display_name: string; role: 'member' | 'lead' | 'support'; active: number }>;
    return rows.map((row) => ({ id: row.id, displayName: row.display_name, role: row.role, active: row.active === 1 }));
  }
  findById(id: string): StandupRecord | undefined {
    const row = this.db.prepare('SELECT s.*, m.display_name, m.active FROM standups s JOIN members m ON m.id=s.member_id WHERE s.id=?').get(id) as Row | undefined;
    return row ? mapRow(row) : undefined;
  }
  findByMemberDate(memberId: string, teamDate: string): StandupRecord | undefined {
    const row = this.db.prepare('SELECT s.*, m.display_name, m.active FROM standups s JOIN members m ON m.id=s.member_id WHERE s.member_id=? AND s.team_date=?').get(memberId, teamDate) as Row | undefined;
    return row ? mapRow(row) : undefined;
  }
  list(teamDate?: string, memberId?: string, includeInactive = true): StandupRecord[] {
    const conditions: string[] = [];
    const parameters: string[] = [];
    if (teamDate) { conditions.push('s.team_date=?'); parameters.push(teamDate); }
    if (memberId) { conditions.push('s.member_id=?'); parameters.push(memberId); }
    if (!includeInactive) conditions.push('m.active=1');
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = this.db.prepare(`SELECT s.*, m.display_name, m.active FROM standups s JOIN members m ON m.id=s.member_id ${where} ORDER BY m.display_name COLLATE NOCASE, m.id, s.id`).all(...parameters) as Row[];
    return rows.map(mapRow);
  }
  listRange(from: string, to: string, memberId?: string): StandupRecord[] {
    const rows = this.db.prepare(`SELECT s.*, m.display_name, m.active FROM standups s JOIN members m ON m.id=s.member_id WHERE s.team_date BETWEEN ? AND ? ${memberId ? 'AND s.member_id=?' : ''} ORDER BY s.team_date, m.display_name COLLATE NOCASE, m.id, s.id`).all(...(memberId ? [from, to, memberId] : [from, to])) as Row[];
    return rows.map(mapRow);
  }
}
