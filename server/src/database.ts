import Database from 'better-sqlite3';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rosterSchema, type RosterMember } from '../../shared/validation.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const defaultDbPath = process.env.DB_PATH ?? path.resolve(here, '../data/standup.sqlite');
export const rosterPath = process.env.ROSTER_PATH ?? path.resolve(here, '../config/roster.json');

export function openDatabase(dbPath = defaultDbPath, roster: RosterMember[] = loadRoster()): Database.Database {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const database = new Database(dbPath);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  database.pragma('busy_timeout = 5000');
  const schema = readFileSync(path.resolve(here, '../db/schema.sql'), 'utf8');
  database.exec(schema);
  const memberColumns = database.pragma('table_info(members)') as Array<{ name: string }>;
  if (!memberColumns.some(({ name }) => name === 'role')) {
    database.exec("ALTER TABLE members ADD COLUMN role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'lead', 'support'))");
  }
  applyRoster(database, roster);
  return database;
}

export function loadRoster(): RosterMember[] {
  const parsed = rosterSchema.safeParse(JSON.parse(readFileSync(rosterPath, 'utf8')));
  if (!parsed.success) throw new Error(`Invalid roster configuration: ${parsed.error.message}`);
  return parsed.data;
}

function applyRoster(database: Database.Database, roster: RosterMember[]): void {
  const transaction = database.transaction(() => {
    database.prepare('UPDATE members SET active = 0, configured = 0').run();
    const upsert = database.prepare(`INSERT INTO members(id, display_name, role, active, configured) VALUES(?, ?, ?, ?, 1)
      ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name, role = excluded.role, active = excluded.active, configured = 1`);
    for (const member of roster) upsert.run(member.id, member.displayName, member.role, member.active ? 1 : 0);
  });
  transaction();
}
