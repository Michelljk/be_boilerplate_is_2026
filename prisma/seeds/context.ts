import type { Prisma } from '../../src/generated/prisma/client.js';
export interface SeedContext {
  prisma: Prisma.TransactionClient;
  today: string;
  passwordHash: string;
  /** Deduplica los fixtures compartidos durante una ejecución del seed. */
  completedFixtures?: Set<string>;
}
export const demoEmails = {
  admin: 'admin@gkds.test',
  trainer1: 'entrenador1@gkds.test',
  trainer2: 'entrenador2@gkds.test',
  member1: 'miembro1@gkds.test',
  member2: 'miembro2@gkds.test',
  member3: 'miembro3@gkds.test',
} as const;
export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function localAt(date: string, time: string): Date {
  return new Date(`${date}T${time}:00-06:00`);
}
