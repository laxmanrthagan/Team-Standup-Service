import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase } from '../database.js';
import { StandupService } from '../services/standup-service.js';
import { ImportService } from '../services/import-service.js';
import { ExportService } from '../services/export-service.js';
import { teamDateAt, previousWorkingDay, isWritableTeamDate } from '../../../shared/dates.js';
import { standupCreateSchema } from '../../../shared/validation.js';

const dirs: string[] = [];
function setup(now = new Date('2026-10-17T06:00:00.000Z')) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'standup-test-')); dirs.push(dir);
  const db = openDatabase(path.join(dir, 'test.sqlite'));
  return { db, service: new StandupService(db, () => now) };
}
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe('shared validation', () => {
  it('accepts valid task content and rejects missing, empty and oversized fields', () => {
    expect(standupCreateSchema.safeParse({ memberId: 'member-01', teamDate: '2026-10-17', tasks: ['Ship update'] }).success).toBe(true);
    expect(standupCreateSchema.safeParse({ memberId: 'member-01', teamDate: '2026-10-17', tasks: [] }).success).toBe(false);
    expect(standupCreateSchema.safeParse({ memberId: 'member-01', teamDate: '2026-02-30', tasks: ['Ship update'] }).success).toBe(false);
    expect(standupCreateSchema.safeParse({ memberId: 'member-01', teamDate: '2026-10-17', tasks: ['x'.repeat(501)] }).success).toBe(false);
  });
});

describe('team date rules', () => {
  it('uses Kolkata date rather than UTC around local midnight', () => {
    expect(teamDateAt(new Date('2026-01-01T18:29:59.999Z'))).toBe('2026-01-01');
    expect(teamDateAt(new Date('2026-01-01T18:30:00.000Z'))).toBe('2026-01-02');
  });
  it.each([
    ['2026-10-17', '2026-10-16'],
    ['2026-10-18', '2026-10-16'],
    ['2026-10-19', '2026-10-16'],
    ['2026-10-20', '2026-10-19'],
  ])('calculates prior working day for %s', (today, previous) => expect(previousWorkingDay(today)).toBe(previous));
  it('allows only today and previous working day', () => {
    expect(isWritableTeamDate('2026-10-17', '2026-10-17')).toBe(true);
    expect(isWritableTeamDate('2026-10-16', '2026-10-17')).toBe(true);
    expect(isWritableTeamDate('2026-10-15', '2026-10-17')).toBe(false);
  });
});

describe('standup service', () => {
  it('creates one entry, rejects duplicate/unknown member and audits updates', () => {
    const { db, service } = setup();
    try {
      const created = service.create({ memberId: 'member-01', teamDate: '2026-10-17', tasks: ['Plan work'] });
      expect(created.tasks).toEqual(['Plan work']);
      expect(() => service.create({ memberId: 'member-01', teamDate: '2026-10-17', tasks: ['Duplicate'] })).toThrow('already exists');
      expect(() => service.create({ memberId: 'unknown', teamDate: '2026-10-17', tasks: ['x'] })).toThrow('not found');
      service.update(created.id, { tasks: ['Updated'], blockers: 'Waiting' });
      const audit = db.prepare('SELECT previous_value_json,new_value_json FROM audit_events WHERE standup_id=?').get(created.id) as { previous_value_json: string; new_value_json: string };
      expect(JSON.parse(audit.previous_value_json)).toEqual({ tasks: ['Plan work'], blockers: '' });
      expect(JSON.parse(audit.new_value_json)).toEqual({ tasks: ['Updated'], blockers: 'Waiting' });
    } finally { db.close(); }
  });
  it('rejects writes outside the writable window', () => {
    const { db, service } = setup(new Date('2026-10-17T06:00:00.000Z'));
    try { expect(() => service.create({ memberId: 'member-01', teamDate: '2026-10-15', tasks: ['Old'] })).toThrow('today or the previous'); }
    finally { db.close(); }
  });
  it('moves the create and correction window immediately across team-local midnight', () => {
    let now = new Date('2026-10-19T18:29:59.999Z');
    const { db } = setup(now);
    const service = new StandupService(db, () => now);
    try {
      const friday = service.create({ memberId: 'member-01', teamDate: '2026-10-16', tasks: ['Friday original'] });
      service.update(friday.id, { tasks: ['Monday correction'] });
      expect(service.dashboard().panels.map(({ teamDate }) => teamDate)).toEqual(['2026-10-19', '2026-10-16']);
      now = new Date('2026-10-19T18:30:00.000Z');
      expect(service.dashboard().panels.map(({ teamDate }) => teamDate)).toEqual(['2026-10-20', '2026-10-19']);
      expect(() => service.update(friday.id, { tasks: ['Too late'] })).toThrow('today or the previous');
      expect(() => service.create({ memberId: 'member-02', teamDate: '2026-10-16', tasks: ['Too late'] })).toThrow('today or the previous');
      const monday = service.create({ memberId: 'member-01', teamDate: '2026-10-19', tasks: ['Monday original'] });
      expect(service.update(monday.id, { tasks: ['Tuesday correction'] }).tasks).toEqual(['Tuesday correction']);
      expect(service.get(friday.id)?.tasks).toEqual(['Monday correction']);
      expect((db.prepare('SELECT COUNT(*) AS count FROM audit_events').get() as { count: number }).count).toBe(2);
    } finally { db.close(); }
  });
  it('retains renamed/removed member history but prevents inactive writes and missing counts', () => {
    const { db, service } = setup();
    try {
      const created = service.create({ memberId: 'member-01', teamDate: '2026-10-17', tasks: ['Retained history'] });
      db.prepare('UPDATE members SET display_name=?, active=0 WHERE id=?').run('Renamed Synthetic Member', 'member-01');
      expect(service.history('2026-10-17', 'member-01').standups[0]).toMatchObject({ id: created.id, displayName: 'Renamed Synthetic Member', tasks: ['Retained history'] });
      expect(service.dashboard().panels.every((panel) => panel.missingMembers.every(({ id }) => id !== 'member-01'))).toBe(true);
      expect(() => service.create({ memberId: 'member-01', teamDate: '2026-10-16', tasks: ['Inactive'] })).toThrow('Active member was not found');
      expect(() => service.update(created.id, { tasks: ['Inactive correction'] })).toThrow('Active member was not found');
      expect(service.get(created.id)?.tasks).toEqual(['Retained history']);
    } finally { db.close(); }
  });
  it('rolls back a correction if its audit insert fails', () => {
    const { db, service } = setup();
    try {
      const created = service.create({ memberId: 'member-01', teamDate: '2026-10-16', tasks: ['Original Friday'], blockers: 'Original blocker' });
      db.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT, 'forced audit failure'); END;");
      expect(() => service.update(created.id, { tasks: ['Must roll back'], blockers: '' })).toThrow('forced audit failure');
      expect(service.get(created.id)).toMatchObject({ tasks: ['Original Friday'], blockers: 'Original blocker', updatedAtUtc: created.updatedAtUtc });
      expect((db.prepare('SELECT COUNT(*) AS count FROM audit_events').get() as { count: number }).count).toBe(0);
    } finally { db.close(); }
  });
  it('preserves a committed standup and audit event after reopening SQLite', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'standup-restart-')); dirs.push(dir);
    const filename = path.join(dir, 'persistent.sqlite');
    const first = openDatabase(filename);
    const service = new StandupService(first, () => new Date('2026-10-17T06:00:00.000Z'));
    const created = service.create({ memberId: 'member-01', teamDate: '2026-10-17', tasks: ['Before restart'] });
    service.update(created.id, { tasks: ['After restart'] });
    first.close();
    const reopened = openDatabase(filename);
    try {
      const restored = new StandupService(reopened).get(created.id);
      expect(restored?.tasks).toEqual(['After restart']);
      expect((reopened.prepare('SELECT COUNT(*) AS count FROM audit_events WHERE standup_id=?').get(created.id) as { count: number }).count).toBe(1);
    } finally { reopened.close(); }
  });
});

describe('import and export', () => {
  it('sorts missing members independently of configuration order', () => {
    const { db } = setup();
    try {
      db.prepare('UPDATE members SET display_name=? WHERE id=?').run('Zulu Synthetic', 'member-01');
      db.prepare('UPDATE members SET display_name=? WHERE id=?').run('Alpha Synthetic', 'member-10');
      const markdown = new ExportService(db).exportDate('2026-10-17');
      const missing = markdown.split('## Missing')[1]!;
      expect(missing.indexOf('Alpha Synthetic')).toBeLessThan(missing.indexOf('Member 02'));
      expect(missing.indexOf('Member 09')).toBeLessThan(missing.indexOf('Zulu Synthetic'));
    } finally { db.close(); }
  });
  it('maps legacy today/yesterday text into separate team-date standups', () => {
    const { db, service } = setup();
    try {
      const source = JSON.stringify({ version: 1, standups: [{ memberId: 'member-01', date: '2025-01-06', today: 'Ship feature\nFix lint', yesterday: 'Review tests' }] });
      const result = new ImportService(db, service).importJson('legacy-v1.json', source);
      expect(result).toMatchObject({ total: 1, standupCandidates: 2, imported: 2 });
      expect(service.list('2025-01-06', 'member-01')[0]?.tasks).toEqual(['Ship feature', 'Fix lint']);
      expect(service.list('2025-01-03', 'member-01')[0]?.tasks).toEqual(['Review tests']);
    } finally { db.close(); }
  });
  it('reports invalid and duplicate rows, imports once and safely exports markup', () => {
    const { db, service } = setup();
    try {
      const importer = new ImportService(db, service);
      service.createValidated({ memberId: 'member-02', teamDate: '2025-01-02', tasks: ['Existing value'], blockers: '' }, false);
      const source = JSON.stringify({ version: 1, standups: [
        { memberName: 'Member 01', date: '2025-01-01', tasks: ['<script>alert(1)</script>'] },
        { memberId: 'member-01', date: '2025-01-01', tasks: ['Duplicate'] },
        { memberName: 'No Such Person', date: '2025-01-01', tasks: ['Unknown'] },
        { memberId: 'member-02', date: '2025-02-30', tasks: ['Bad date'] },
        { memberId: 'member-03', date: '2025-01-03' },
        { memberId: 'member-02', date: '2025-01-02', tasks: ['Conflicting legacy value'] },
      ] });
      const result = importer.importJson('synthetic.json', source);
      expect(result).toMatchObject({ imported: 1, skipped: 2, rejected: 3 });
      expect(result.rows[2]).toMatchObject({ status: 'rejected', reason: 'Unknown member name.' });
      expect(result.rows[4]?.status).toBe('rejected');
      expect(result.rows[5]).toMatchObject({ status: 'skipped', reason: 'Record already exists in database.' });
      expect(importer.importJson('synthetic.json', source).status).toBe('already_imported');
      expect(service.list('2025-01-01')).toHaveLength(1);
      const markdown = new ExportService(db).exportDate('2025-01-01');
      expect(new ExportService(db).exportDate('2025-01-01')).toBe(markdown);
      expect(markdown).not.toContain('<script>');
      expect(markdown).toContain('&lt;script&gt;');
    } finally { db.close(); }
  });
  it('rolls back all records on an unexpected transaction failure', () => {
    const { db, service } = setup();
    try {
      db.exec("CREATE TRIGGER fail_import BEFORE INSERT ON import_jobs BEGIN SELECT RAISE(ABORT, 'forced failure'); END;");
      const importer = new ImportService(db, service);
      const source = JSON.stringify({ version: 1, standups: [{ memberId: 'member-01', date: '2025-01-01', tasks: ['First'] }] });
      expect(() => importer.importJson('synthetic.json', source)).toThrow('forced failure');
      expect(service.list('2025-01-01')).toHaveLength(0);
      expect((db.prepare('SELECT COUNT(*) AS count FROM import_jobs').get() as { count: number }).count).toBe(0);
    } finally { db.close(); }
  });
});
