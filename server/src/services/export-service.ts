import type Database from 'better-sqlite3';
import { StandupRepository } from '../repositories/standup-repository.js';
import { escapeMarkdown } from './markdown.js';

export class ExportService {
  private readonly repository: StandupRepository;
  constructor(db: Database.Database) { this.repository = new StandupRepository(db); }
  exportDate(teamDate: string): string {
    const records = this.repository.list(teamDate, undefined, false);
    const submitted = new Set(records.map(({ memberId }) => memberId));
    const members = this.repository.members(true);
    const missing = members.filter(({ id }) => !submitted.has(id));
    const lines = ['# Team Standup', `Date: ${teamDate}`, '', '## Submitted', ''];
    for (const record of records) {
      lines.push(`### ${escapeMarkdown(record.displayName)}`, '', 'Tasks:');
      for (const task of record.tasks) lines.push(`- ${escapeMarkdown(task)}`);
      lines.push('', 'Blockers:', record.blockers ? `- ${escapeMarkdown(record.blockers)}` : '- None', '');
    }
    lines.push('## Missing', '');
    for (const member of missing) lines.push(`- ${escapeMarkdown(member.displayName)}`);
    return `${lines.join('\n').trimEnd()}\n`;
  }
}
