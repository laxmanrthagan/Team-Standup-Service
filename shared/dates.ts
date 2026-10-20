export const TEAM_TIME_ZONE = process.env.TEAM_TIME_ZONE ?? 'Asia/Kolkata';

export function teamDateAt(now: Date = new Date(), timeZone = TEAM_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function previousWorkingDay(date: string): string {
  const cursor = new Date(`${date}T12:00:00.000Z`);
  do {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  } while (cursor.getUTCDay() === 0 || cursor.getUTCDay() === 6);
  return cursor.toISOString().slice(0, 10);
}

export function isWritableTeamDate(date: string, today = teamDateAt()): boolean {
  return date === today || date === previousWorkingDay(today);
}

export function previousCalendarDate(date: string): string {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}
