import { seedStoryFixtures } from './story-fixtures.seed.js';
import type { SeedContext } from './context.js';

/** Prepara fixtures compartidos para los criterios de H7. */
export async function seedH7(ctx: SeedContext): Promise<void> {
  await seedStoryFixtures(ctx, 7);
}
