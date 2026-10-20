import type Database from 'better-sqlite3';

export class AuditService {
  constructor(private readonly db: Database.Database) {}
  forStandup(standupId: string): Array<{ id: string; eventType: string; timestampUtc: string; previousValue: unknown; newValue: unknown }> {
    return (this.db.prepare('SELECT id,event_type,timestamp_utc,previous_value_json,new_value_json FROM audit_events WHERE standup_id=? ORDER BY timestamp_utc,id').all(standupId) as Array<{ id: string; event_type: string; timestamp_utc: string; previous_value_json: string; new_value_json: string }>).map((row) => ({ id: row.id, eventType: row.event_type, timestampUtc: row.timestamp_utc, previousValue: JSON.parse(row.previous_value_json) as unknown, newValue: JSON.parse(row.new_value_json) as unknown }));
  }
}
