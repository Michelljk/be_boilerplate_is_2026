import { seedStoryFixtures } from './story-fixtures.seed.js';
import type { SeedContext } from './context.js';

/** Prepara fixtures compartidos para los criterios de H30. */
export async function seedH30(ctx: SeedContext): Promise<void> {
  await seedStoryFixtures(ctx, 30);
}
