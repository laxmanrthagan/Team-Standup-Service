import express, { type ErrorRequestHandler, type Request, type Response } from 'express';
import path from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import type Database from 'better-sqlite3';
import { teamDateSchema, memberIdSchema } from '../../shared/validation.js';
import { StandupService } from './services/standup-service.js';
import { ExportService } from './services/export-service.js';
import { AuditService } from './services/audit-service.js';
import { ServiceError } from './services/errors.js';
import { correlationMiddleware, log } from './logger.js';

const packageJson = JSON.parse(readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8')) as { version: string };
const ok = (response: Response, data: unknown, status = 200) => response.status(status).json({ success: true, data });
const fail = (response: Response, status: number, code: string, message: string) => response.status(status).json({ success: false, error: { code, message } });

export function createApp(db: Database.Database, now?: () => Date) {
  const app = express();
  const service = new StandupService(db, now);
  const exporter = new ExportService(db);
  const audit = new AuditService(db);
  app.disable('x-powered-by');
  app.disable('etag');
  app.use(correlationMiddleware);
  app.use(express.json({ limit: '256kb', strict: true }));
  const api = express.Router();
  api.use((request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    delete request.headers['if-none-match'];
    delete request.headers['if-modified-since'];
    next();
  });

  api.get('/health', (_request, response) => {
    try {
      db.prepare('SELECT 1').get();
      const journal = String(db.pragma('journal_mode', { simple: true })).toLowerCase();
      const schemaVersion = Number(db.pragma('user_version', { simple: true }));
      const status = journal === 'wal' ? 'Healthy' : 'Degraded';
      return ok(response, { status, database: { status, engine: 'SQLite', schemaVersion }, version: packageJson.version });
    } catch {
      log('health_probe_failed', { correlationId: String(response.locals.correlationId) });
      return fail(response, 503, 'DATABASE_UNAVAILABLE', 'Database health check failed');
    }
  });
  api.get('/members', (_request, response) => ok(response, service.members()));
  api.get('/standups', (request, response) => {
    const date = request.query.teamDate;
    const memberId = request.query.memberId;
    if (date !== undefined && (typeof date !== 'string' || !teamDateSchema.safeParse(date).success)) return fail(response, 400, 'INVALID_TEAM_DATE', 'teamDate must be a valid YYYY-MM-DD date.');
    if (memberId !== undefined && (typeof memberId !== 'string' || !memberIdSchema.safeParse(memberId).success)) return fail(response, 400, 'INVALID_MEMBER_ID', 'memberId is malformed.');
    if (typeof memberId === 'string' && !service.members().some((member) => member.id === memberId)) return fail(response, 404, 'MEMBER_NOT_FOUND', 'Member was not found.');
    return ok(response, service.list(date as string | undefined, memberId as string | undefined));
  });
  api.get('/standups/:id', (request, response) => {
    const standup = service.get(request.params.id!);
    if (!standup) return fail(response, 404, 'STANDUP_NOT_FOUND', 'Standup was not found.');
    return ok(response, { ...standup, audit: audit.forStandup(standup.id) });
  });
  api.post('/standups', (request, response) => ok(response, service.create(request.body), 201));
  api.put('/standups/:id', (request, response) => ok(response, service.update(request.params.id!, request.body)));
  api.get('/history', (request, response) => {
    const date = request.query.teamDate;
    const from = request.query.from;
    const to = request.query.to;
    const memberId = request.query.memberId;
    if (from !== undefined || to !== undefined) {
      if (typeof from !== 'string' || typeof to !== 'string' || !teamDateSchema.safeParse(from).success || !teamDateSchema.safeParse(to).success || from > to) return fail(response, 400, 'INVALID_DATE_RANGE', 'from and to must be valid dates in ascending order.');
      const start = new Date(`${from}T12:00:00.000Z`);
      const end = new Date(`${to}T12:00:00.000Z`);
      const span = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
      if (span > 30) return fail(response, 400, 'DATE_RANGE_TOO_LARGE', 'History ranges may include at most 30 calendar dates.');
      if (memberId !== undefined && (typeof memberId !== 'string' || !memberIdSchema.safeParse(memberId).success)) return fail(response, 400, 'INVALID_MEMBER_ID', 'memberId is malformed.');
      if (typeof memberId === 'string' && !service.members().some((member) => member.id === memberId)) return fail(response, 404, 'MEMBER_NOT_FOUND', 'Member was not found.');
      return ok(response, service.historyRange(from, to, memberId as string | undefined));
    }
    if (typeof date !== 'string' || !teamDateSchema.safeParse(date).success) return fail(response, 400, 'INVALID_TEAM_DATE', 'A valid teamDate query parameter is required.');
    if (memberId !== undefined && (typeof memberId !== 'string' || !memberIdSchema.safeParse(memberId).success)) return fail(response, 400, 'INVALID_MEMBER_ID', 'memberId is malformed.');
    if (typeof memberId === 'string' && !service.members().some((member) => member.id === memberId)) return fail(response, 404, 'MEMBER_NOT_FOUND', 'Member was not found.');
    return ok(response, service.history(date, memberId as string | undefined));
  });
  api.get('/dashboard', (request, response) => {
    const date = request.query.date;
    if (date !== undefined && (typeof date !== 'string' || !teamDateSchema.safeParse(date).success)) return fail(response, 400, 'INVALID_TEAM_DATE', 'date must be a valid YYYY-MM-DD date.');
    return ok(response, service.dashboard(date as string | undefined));
  });
  api.get('/export/:date', (request, response) => {
    const date = request.params.date!;
    if (!teamDateSchema.safeParse(date).success) return fail(response, 400, 'INVALID_TEAM_DATE', 'Date must be a valid YYYY-MM-DD date.');
    return ok(response, { teamDate: date, markdown: exporter.exportDate(date) });
  });
  api.use((_request, response) => fail(response, 404, 'NOT_FOUND', 'API endpoint was not found.'));
  app.use('/api/v1', api);
  app.get('/api/*path', (_request, response) => fail(response, 404, 'NOT_FOUND', 'API endpoint was not found.'));

  const clientDist = path.resolve(process.cwd(), 'client/dist');
  if (existsSync(clientDist)) {
    app.use(express.static(clientDist, { index: false }));
    app.get('*path', (_request, response) => response.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use(((error: unknown, request: Request, response: Response, next) => {
    if (response.headersSent) return next(error);
    if (error instanceof ServiceError) {
      log('validation_or_business_failure', { correlationId: String(response.locals.correlationId), code: error.code, status: error.status });
      return fail(response, error.status, error.code, error.message);
    }
    if (error instanceof SyntaxError && 'status' in error) return fail(response, 400, 'INVALID_JSON', 'Request body must contain valid JSON.');
    log('request_failed', { correlationId: String(response.locals.correlationId), method: request.method, path: request.path, code: 'INTERNAL_ERROR' });
    return fail(response, 500, 'INTERNAL_ERROR', 'An unexpected error occurred.');
  }) as ErrorRequestHandler);
  return app;
}
