import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const roots = ['client/src', 'server/src', 'shared', 'docs'];
const extensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.md', '.json', '.css']);
const suspiciousAssignment = /(?:api[_-]?key|password|secret|access[_-]?token)\s*[:=]\s*["'][^"'\s]{8,}["']/i;
const findings = [];

async function walk(directory) {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(filename);
    else if (extensions.has(path.extname(entry.name))) {
      const text = await readFile(filename, 'utf8');
      if (suspiciousAssignment.test(text)) findings.push(filename);
    }
  }
}

for (const root of roots) await walk(root);
if (findings.length) {
  console.error(`Potential credential assignment found in: ${findings.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('Secret scan passed: no credential-like assignments in scanned source/docs.');
}
