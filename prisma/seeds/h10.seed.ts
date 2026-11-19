import { seedStoryFixtures } from './story-fixtures.seed.js';
import type { SeedContext } from './context.js';

/** Prepara fixtures compartidos para los criterios de H10. */
export async function seedH10(ctx: SeedContext): Promise<void> {
  await seedStoryFixtures(ctx, 10);
}
