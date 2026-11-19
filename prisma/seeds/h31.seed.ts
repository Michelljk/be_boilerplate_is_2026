import { seedStoryFixtures } from './story-fixtures.seed.js';
import type { SeedContext } from './context.js';

/** Prepara fixtures compartidos para los criterios de H31. */
export async function seedH31(ctx: SeedContext): Promise<void> {
  await seedStoryFixtures(ctx, 31);
}
