PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'lead', 'support')),
  active INTEGER NOT NULL CHECK (active IN (0, 1)),
  configured INTEGER NOT NULL DEFAULT 1 CHECK (configured IN (0, 1))
);
CREATE TABLE IF NOT EXISTS standups (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id),
  team_date TEXT NOT NULL CHECK (length(team_date) = 10),
  tasks_json TEXT NOT NULL,
  blockers TEXT NOT NULL DEFAULT '',
  created_at_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL,
  UNIQUE(member_id, team_date)
);
CREATE INDEX IF NOT EXISTS idx_standups_date_member ON standups(team_date, member_id);
CREATE INDEX IF NOT EXISTS idx_standups_member_date ON standups(member_id, team_date);
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  standup_id TEXT NOT NULL REFERENCES standups(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('updated')),
  timestamp_utc TEXT NOT NULL,
  previous_value_json TEXT NOT NULL,
  new_value_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_standup_time ON audit_events(standup_id, timestamp_utc);
CREATE TABLE IF NOT EXISTS import_jobs (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_sha256 TEXT NOT NULL UNIQUE,
  imported_at_utc TEXT NOT NULL,
  status TEXT NOT NULL,
  report_json TEXT NOT NULL
);
PRAGMA user_version = 2;
