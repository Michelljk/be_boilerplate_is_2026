import { seedStoryFixtures } from './story-fixtures.seed.js';
import type { SeedContext } from './context.js';

/** Prepara fixtures compartidos para los criterios de H29. */
export async function seedH29(ctx: SeedContext): Promise<void> {
  await seedStoryFixtures(ctx, 29);
}
