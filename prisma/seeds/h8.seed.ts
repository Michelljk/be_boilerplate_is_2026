import { seedStoryFixtures } from './story-fixtures.seed.js';
import type { SeedContext } from './context.js';

/** Prepara fixtures compartidos para los criterios de H8. */
export async function seedH8(ctx: SeedContext): Promise<void> {
  await seedStoryFixtures(ctx, 8);
}
