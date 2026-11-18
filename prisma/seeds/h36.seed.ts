import { seedStoryFixtures } from './story-fixtures.seed.js';
import type { SeedContext } from './context.js';

/** Prepara fixtures compartidos para los criterios de H36. */
export async function seedH36(ctx: SeedContext): Promise<void> {
  await seedStoryFixtures(ctx, 36);
}
