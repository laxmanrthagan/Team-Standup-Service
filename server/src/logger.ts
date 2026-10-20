import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export function log(event: string, fields: Record<string, string | number | boolean | undefined> = {}): void {
  console.log(JSON.stringify({ timestampUtc: new Date().toISOString(), level: 'info', event, ...fields }));
}

export function correlationMiddleware(request: Request, response: Response, next: NextFunction): void {
  const supplied = request.header('x-correlation-id');
  const correlationId = supplied && /^[A-Za-z0-9_-]{1,64}$/u.test(supplied) ? supplied : randomUUID();
  response.setHeader('x-correlation-id', correlationId);
  response.locals.correlationId = correlationId;
  const started = Date.now();
  response.on('finish', () => log('http_request', { correlationId, method: request.method, path: request.path, status: response.statusCode, durationMs: Date.now() - started }));
  next();
}
