import { openDatabase } from './database.js';
import { StandupService } from './services/standup-service.js';
import { teamDateAt, previousWorkingDay } from '../../shared/dates.js';

const database = openDatabase();
const service = new StandupService(database);
const today = teamDateAt();
const yesterday = previousWorkingDay(today);
const sampleTasks = [
  'Reviewed dashboard interactions',
  'Validated standup date handling',
  'Checked history filtering behavior',
  'Reviewed API response consistency',
  'Verified export formatting',
  'Tested submission validation',
  'Reviewed database health checks',
  'Checked accessibility labels',
  'Validated blocker display behavior',
  'Reviewed local startup documentation',
];
let inserted = 0;
for (const [index, member] of service.members().filter(({ active }) => active).entries()) {
  for (const teamDate of [today, yesterday]) {
    if (service.list(teamDate, member.id).length === 0) {
      const blockers = index === 5 && teamDate === today ? 'Synthetic sample blocker: waiting for review.' : '';
      service.create({ memberId: member.id, teamDate, tasks: [`Synthetic sample: ${sampleTasks[index % sampleTasks.length]}.`], blockers });
      inserted++;
    }
  }
}
database.close();
console.log(`Seeded ${inserted} synthetic standup record(s).`);
