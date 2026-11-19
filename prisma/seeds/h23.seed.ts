import { seedStoryFixtures } from './story-fixtures.seed.js';
import type { SeedContext } from './context.js';

/** Prepara fixtures compartidos para los criterios de H23. */
export async function seedH23(ctx: SeedContext): Promise<void> {
  await seedStoryFixtures(ctx, 23);
}
