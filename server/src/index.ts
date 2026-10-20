import { createApp } from './app.js';
import { openDatabase } from './database.js';
import { log } from './logger.js';

const database = openDatabase();
const app = createApp(database);
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '127.0.0.1';
const server = app.listen(port, host, () => log('application_started', { host, port, teamTimeZone: process.env.TEAM_TIME_ZONE ?? 'Asia/Kolkata' }));

function shutdown(): void {
  server.close(() => {
    database.close();
    log('application_stopped');
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
