import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase } from '../database.js';
import { createApp } from '../app.js';
import type Database from 'better-sqlite3';

const resources: Array<{ db: Database.Database; dir: string }> = [];
function setup(now = () => new Date('2026-10-17T06:00:00.000Z')) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'standup-api-'));
  const db = openDatabase(path.join(dir, 'test.sqlite'));
  resources.push({ db, dir });
  return { db, app: createApp(db, now) };
}
afterEach(() => { for (const { db, dir } of resources.splice(0)) { db.close(); rmSync(dir, { recursive: true, force: true }); } vi.restoreAllMocks(); });

describe('versioned API', () => {
  it('returns health envelope and correlation ID', async () => {
    const { app } = setup();
    const response = await request(app).get('/api/v1/health').expect(200);
    expect(response.body).toMatchObject({ success: true, data: { status: 'Healthy', database: { status: 'Healthy', engine: 'SQLite', schemaVersion: 2 }, version: '1.0.0' } });
    expect(response.headers['x-correlation-id']).toBeTruthy();
    expect(response.headers['cache-control']).toBe('no-store');
  });
  it('serves the configured synthetic functional roles without adding roster CRUD', async () => {
    const { app } = setup();
    const response = await request(app).get('/api/v1/members').expect(200);
    expect(response.body.data).toHaveLength(10);
    expect(response.body.data).toContainEqual(expect.objectContaining({ id: 'member-09', role: 'lead' }));
    expect(response.body.data).toContainEqual(expect.objectContaining({ id: 'member-10', role: 'support' }));
    const mutation = await request(app).post('/api/v1/members').send({ id: 'new-member', displayName: 'Unexpected' }).expect(404);
    expect(mutation.body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
  });
  it('never returns 304 to fetch clients holding an older cached API response', async () => {
    const { app } = setup();
    const response = await request(app).get('/api/v1/members').set('If-None-Match', '*').expect(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers.etag).toBeUndefined();
  });
  it('creates, reads, updates and exports safely with consistent envelopes', async () => {
    const { app } = setup();
    const created = await request(app).post('/api/v1/standups').send({ memberId: 'member-01', teamDate: '2026-10-17', tasks: ['<img src=x>'] }).expect(201);
    expect(created.body.success).toBe(true);
    const id = created.body.data.id as string;
    await request(app).post('/api/v1/standups').send({ memberId: 'member-01', teamDate: '2026-10-17', tasks: ['Duplicate'] }).expect(409);
    await request(app).put(`/api/v1/standups/${id}`).send({ tasks: ['<img src=x> Revised'] }).expect(200);
    const detail = await request(app).get(`/api/v1/standups/${id}`).expect(200);
    expect(detail.body.data.audit).toHaveLength(1);
    const exported = await request(app).get('/api/v1/export/2026-10-17').expect(200);
    expect(exported.body.data.markdown).toContain('&lt;img');
    const history = await request(app).get('/api/v1/history?teamDate=2026-10-17').expect(200);
    expect(history.body.data.standups).toHaveLength(1);
    await request(app).get('/api/v1/history?teamDate=2026-10-17&memberId=unknown').expect(404);
    await request(app).get('/api/v1/standups?memberId=unknown').expect(404);
  });
  it('rejects malformed payloads and writable dates outside the window', async () => {
    const { app } = setup();
    const bad = await request(app).post('/api/v1/standups').send({ memberId: 'member-01', teamDate: '2026-02-30', tasks: [] }).expect(400);
    expect(bad.body).toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR' } });
    await request(app).post('/api/v1/standups').send({ memberId: 'member-01', teamDate: '2020-01-01', tasks: ['old'] }).expect(400);
  });
  it.each(['2026-10-17', '2026-10-18', '2026-10-19'])('creates and corrects Friday via API on %s with one entry and an audit', async (today) => {
    let now = new Date(`${today}T06:00:00.000Z`);
    const { app } = setup(() => now);
    const created = await request(app).post('/api/v1/standups').send({ memberId: 'member-01', teamDate: '2026-10-16', tasks: ['Friday original'], blockers: 'Waiting' }).expect(201);
    const id = created.body.data.id as string;
    const changed = await request(app).put(`/api/v1/standups/${id}`).send({ tasks: ['Friday corrected'], blockers: '' }).expect(200);
    expect(changed.body.data).toMatchObject({ id, teamDate: '2026-10-16', tasks: ['Friday corrected'], blockers: '' });
    const dashboardResult = await request(app).get('/api/v1/dashboard').expect(200);
    expect(dashboardResult.body.data).toMatchObject({ teamDate: today, previousWorkingDay: '2026-10-16' });
    expect(dashboardResult.body.data.panels[1].submittedMembers).toHaveLength(1);
    const detail = await request(app).get(`/api/v1/standups/${id}`).expect(200);
    expect(detail.body.data.audit).toHaveLength(1);
    now = new Date('2026-10-20T06:00:00.000Z');
    const expired = await request(app).put(`/api/v1/standups/${id}`).send({ tasks: ['Too late'] }).expect(400);
    expect(expired.body.error.code).toBe('INVALID_TEAM_DATE');
    const unchanged = await request(app).get(`/api/v1/standups/${id}`).expect(200);
    expect(unchanged.body.data.tasks).toEqual(['Friday corrected']);
    expect(unchanged.body.data.audit).toHaveLength(1);
  });
  it('supports indexed 30-day history ranges and rejects larger ranges', async () => {
    const { app } = setup();
    const result = await request(app).get('/api/v1/history?from=2026-10-01&to=2026-10-30').expect(200);
    expect(result.body.data).toMatchObject({ from: '2026-10-01', to: '2026-10-30', standups: [] });
    await request(app).get('/api/v1/history?from=2026-10-01&to=2026-10-31').expect(400);
  });
  it('never writes task or blocker content to request logs', async () => {
    const output = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { app } = setup();
    await request(app).post('/api/v1/standups').send({ memberId: 'member-01', teamDate: '2026-10-17', tasks: ['private-task-phrase'], blockers: 'private-blocker-phrase' }).expect(201);
    const logs = output.mock.calls.flat().join('\n');
    expect(logs).not.toContain('private-task-phrase');
    expect(logs).not.toContain('private-blocker-phrase');
  });
  it('returns 503 health envelope when storage is closed', async () => {
    const { db, app } = setup();
    db.close();
    const response = await request(app).get('/api/v1/health').expect(503);
    expect(response.body).toEqual({ success: false, error: { code: 'DATABASE_UNAVAILABLE', message: 'Database health check failed' } });
    resources[resources.length - 1]!.db = { close() {} } as Database.Database;
  });
});
