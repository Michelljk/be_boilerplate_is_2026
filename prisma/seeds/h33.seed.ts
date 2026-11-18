import { seedStoryFixtures } from './story-fixtures.seed.js';
import type { SeedContext } from './context.js';

/** Prepara fixtures compartidos para los criterios de H33. */
export async function seedH33(ctx: SeedContext): Promise<void> {
  await seedStoryFixtures(ctx, 33);
}
