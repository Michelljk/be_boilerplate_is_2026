import { seedStoryFixtures } from './story-fixtures.seed.js';
import type { SeedContext } from './context.js';

/** Prepara fixtures compartidos para los criterios de H38. */
export async function seedH38(ctx: SeedContext): Promise<void> {
  await seedStoryFixtures(ctx, 38);
}
