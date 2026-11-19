import { seedStoryFixtures } from './story-fixtures.seed.js';
import type { SeedContext } from './context.js';

/** Prepara fixtures compartidos para los criterios de H18. */
export async function seedH18(ctx: SeedContext): Promise<void> {
  await seedStoryFixtures(ctx, 18);
}
