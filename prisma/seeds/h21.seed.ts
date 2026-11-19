import { seedStoryFixtures } from './story-fixtures.seed.js';
import type { SeedContext } from './context.js';

/** Prepara fixtures compartidos para los criterios de H21. */
export async function seedH21(ctx: SeedContext): Promise<void> {
  await seedStoryFixtures(ctx, 21);
}
