import type { SeedContext } from './context.js';
import { seedH40 } from './h40.seed.js';
import { seedH4 } from './h4.seed.js';
import { seedH9 } from './h9.seed.js';
import { seedH12 } from './h12.seed.js';
import { seedH22 } from './h22.seed.js';
import { seedH27 } from './h27.seed.js';

/**
 * A story seed makes the deterministic demo preconditions for the story's API
 * available. Related stories share fixtures (users, memberships, classes, etc.);
 * repeated requests in a single `prisma db seed` call are deduplicated.
 */
const fixtureDependencies: Record<number, readonly string[]> = {
  1: ['core'],
  2: ['core'],
  3: ['core'],
  4: ['core', 'classes'],
  5: ['core', 'classes'],
  6: ['core', 'classes'],
  7: ['core', 'classes'],
  8: ['core', 'classes'],
  9: ['core', 'slots'],
  10: ['core', 'slots'],
  11: ['core', 'slots'],
  12: ['core', 'slots'],
  13: ['core'],
  14: ['core'],
  15: ['core'],
  16: ['core'],
  17: ['core'],
  18: ['core'],
  19: ['core'],
  20: ['core'],
  21: ['core'],
  22: ['core', 'routines'],
  23: ['core', 'routines'],
  24: ['core', 'routines'],
  25: ['core', 'routines'],
  26: ['core', 'routines'],
  27: ['core', 'machines'],
  28: ['core', 'machines'],
  29: ['core', 'classes'],
  30: ['core', 'classes'],
  31: ['core'],
  32: ['core'],
  33: ['core'],
  34: ['core'],
  35: ['core'],
  36: ['core', 'classes', 'slots', 'routines', 'machines'],
  37: ['core', 'classes', 'slots', 'routines', 'machines'],
  38: ['core', 'classes', 'slots', 'routines', 'machines'],
  39: ['core', 'classes', 'slots', 'routines', 'machines'],
};

const runners: Record<string, (ctx: SeedContext) => Promise<void>> = {
  core: seedH40,
  classes: seedH4,
  slots: async (ctx) => {
    await seedH9(ctx);
    await seedH12(ctx);
  },
  routines: seedH22,
  machines: seedH27,
};

export async function seedStoryFixtures(
  ctx: SeedContext,
  storyId: number,
): Promise<void> {
  const dependencies = fixtureDependencies[storyId];
  if (!dependencies)
    throw new Error(`Historia H${storyId} fuera del catálogo.`);
  const completed =
    ctx.completedFixtures ?? (ctx.completedFixtures = new Set<string>());
  for (const name of dependencies) {
    if (completed.has(name)) continue;
    await runners[name]!(ctx);
    completed.add(name);
  }
}

export async function seedAllStoryFixtures(ctx: SeedContext): Promise<void> {
  for (let storyId = 1; storyId <= 39; storyId++)
    await seedStoryFixtures(ctx, storyId);
}
