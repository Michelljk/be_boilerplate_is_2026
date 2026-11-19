import { seedStoryFixtures } from './story-fixtures.seed.js';
import type { SeedContext } from './context.js';

/** Prepara fixtures compartidos para los criterios de H19. */
export async function seedH19(ctx: SeedContext): Promise<void> {
  await seedStoryFixtures(ctx, 19);
}
