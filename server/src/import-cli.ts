import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { openDatabase } from './database.js';
import { StandupService } from './services/standup-service.js';
import { ImportService } from './services/import-service.js';
import { log } from './logger.js';

const fileIndex = process.argv.indexOf('--file');
const filename = fileIndex >= 0 ? process.argv[fileIndex + 1] : undefined;
if (!filename) {
  console.error('Usage: npm run import -- --file <path-to-v1.json>');
  process.exit(2);
}
const database = openDatabase();
try {
  const result = new ImportService(database, new StandupService(database)).importJson(basename(filename), readFileSync(filename, 'utf8'));
  log('import_completed', { jobId: result.jobId ?? '', fileName: basename(filename), total: result.total, imported: result.imported, skipped: result.skipped, rejected: result.rejected, status: result.status });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  log('import_failed', { fileName: basename(filename), code: error instanceof SyntaxError ? 'INVALID_JSON' : 'IMPORT_FAILED' });
  console.error(error instanceof Error ? error.message : 'Import failed.');
  process.exitCode = 1;
} finally {
  database.close();
}
