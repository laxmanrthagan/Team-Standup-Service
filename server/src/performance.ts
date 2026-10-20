import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { openDatabase } from './database.js';
import { createApp } from './app.js';
import { previousCalendarDate, teamDateAt } from '../../shared/dates.js';
import type { RosterMember } from '../../shared/validation.js';

const temporary = mkdtempSync(path.join(os.tmpdir(), 'standup-performance-'));
const today = teamDateAt();
const members: RosterMember[] = Array.from({ length: 20 }, (_, index) => ({ id: `perf-${String(index + 1).padStart(2, '0')}`, displayName: `Performance Member ${String(index + 1).padStart(2, '0')}`, role: 'member', active: true }));
const dates = [today];
while (dates.length < 500) dates.unshift(previousCalendarDate(dates[0]!));
const db = openDatabase(path.join(temporary, 'performance.sqlite'), members);
let server: ReturnType<ReturnType<typeof createApp>['listen']> | undefined;
try {
  const insert = db.prepare('INSERT INTO standups(id,member_id,team_date,tasks_json,blockers,created_at_utc,updated_at_utc) VALUES(?,?,?,?,?,?,?)');
  const seed = db.transaction(() => {
    for (const teamDate of dates) for (const member of members) insert.run(`${member.id}-${teamDate}`, member.id, teamDate, JSON.stringify(['Synthetic measured task']), '', '2026-10-17T00:00:00.000Z', '2026-10-17T00:00:00.000Z');
  });
  seed();
  server = createApp(db).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  const from = dates[470]!;
  const results: { operation: string; samplesMs: number[]; maxMs: number; records: number }[] = [];
  for (const [operation, endpoint] of [
    ['dashboard', '/dashboard'],
    ['history-30-days', `/history?from=${from}&to=${today}`],
  ] as const) {
    const samplesMs: number[] = [];
    let records = 0;
    for (let sample = 0; sample < 5; sample++) {
      const start = performance.now();
      const response = await fetch(`${baseUrl}${endpoint}`);
      const payload = await response.json() as { success: boolean; data: { panels?: Array<{ submittedMembers: unknown[] }>; standups?: unknown[] } };
      if (!response.ok || !payload.success) throw new Error(`Performance request failed: ${operation} HTTP ${response.status}`);
      const resultCount = payload.data.panels?.reduce((count, panel) => count + panel.submittedMembers.length, 0) ?? payload.data.standups?.length ?? 0;
      if (resultCount !== (operation === 'dashboard' ? 40 : 600)) throw new Error(`Unexpected record count for ${operation}: ${resultCount}`);
      samplesMs.push(Number((performance.now() - start).toFixed(3)));
      records = resultCount;
    }
    results.push({ operation, samplesMs, maxMs: Math.max(...samplesMs), records });
  }
  const report = { method: 'loopback HTTP requests including JSON body consumption', dataset: 'locally generated synthetic substitute; official fixture not present', rosterSize: members.length, standupCount: dates.length * members.length, teamDateCount: dates.length, thresholdMs: 500, results };
  console.log(JSON.stringify(report, null, 2));
  if (results.some(({ maxMs }) => maxMs >= 500)) process.exitCode = 1;
} finally {
  if (server) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
  db.close();
  rmSync(temporary, { recursive: true, force: true });
}
