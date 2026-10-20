import { z } from 'zod';

const plainText = (maximum: number) =>
  z.string().transform((value) => value.trim()).pipe(
    z.string()
      .min(1)
      .refine((value) => Array.from(value).length <= maximum, `Must be at most ${maximum} characters.`)
      .refine(isAllowedText, 'Contains unsupported control characters.'),
  );

function isAllowedText(value: string): boolean {
  return Array.from(value).every((character) => {
    const point = character.codePointAt(0)!;
    return point === 0x09 || point === 0x0a || (point >= 0x20 && (point < 0x7f || point > 0x9f));
  });
}

export const memberIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/u);
export const memberRoleSchema = z.enum(['member', 'lead', 'support']);
export const teamDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}, 'Date must be a valid YYYY-MM-DD calendar date.');
export const tasksSchema = z.array(plainText(500)).min(1, 'Enter at least one task.').max(20, 'Enter no more than 20 tasks.');
export const blockersSchema = z.string().transform((value) => value.trim()).pipe(
  z.string().refine((value) => Array.from(value).length <= 1000, 'Must be at most 1000 characters.').refine(isAllowedText, 'Contains unsupported control characters.'),
);
export const standupCreateSchema = z.object({
  memberId: memberIdSchema,
  teamDate: teamDateSchema,
  tasks: tasksSchema,
  blockers: blockersSchema.optional().default(''),
}).strict();
export const standupUpdateSchema = z.object({
  tasks: tasksSchema,
  blockers: blockersSchema.optional().default(''),
}).strict();
export const rosterSchema = z.array(z.object({
  id: memberIdSchema,
  displayName: z.string().trim().min(1).max(100),
  role: memberRoleSchema.default('member'),
  active: z.boolean().default(true),
}).strict()).min(1).max(50).refine((members) => new Set(members.map(({ id }) => id)).size === members.length, 'Member IDs must be unique.').refine((members) => new Set(members.map(({ displayName }) => displayName.toLocaleLowerCase())).size === members.length, 'Display names must be unique.');

export type StandupCreateInput = z.infer<typeof standupCreateSchema>;
export type StandupUpdateInput = z.infer<typeof standupUpdateSchema>;
export type RosterMember = z.infer<typeof rosterSchema>[number];
