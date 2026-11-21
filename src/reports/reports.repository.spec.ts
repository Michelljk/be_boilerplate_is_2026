import { Prisma } from '@PrismaClient';
import { describe, expect, it, vi } from 'vitest';
import { ReportsRepository } from './repositories/reports.repository.js';

describe('ReportsRepository.trainerPerformance', () => {
  it('lee solo sesiones completadas en rango civil y mantiene entrenadores sin reviews', async () => {
    const rows = [
      {
        trainerId: 'trainer-1',
        name: 'Ana',
        completedSessions: 2,
        averageRating: null,
        ratingsCount: 0,
      },
      {
        trainerId: 'trainer-2',
        name: 'Berta',
        completedSessions: 0,
        averageRating: null,
        ratingsCount: 0,
      },
    ];
    let query: Prisma.Sql | undefined;
    const tx = {
      $queryRaw: vi.fn(async (statement: Prisma.Sql) => {
        query = statement;
        return [
          { trainerId: 'trainer-1', completedSessions: 2 },
        ];
      }),
    };
    const prisma = {
      $transaction: vi.fn(async (work: (client: typeof tx) => Promise<unknown>) =>
        work(tx),
      ),
    };
    const reviews = {
      trainerAverages: vi.fn(async () => [
        { trainerId: 'trainer-1', name: 'Ana', reviewCount: 0, averageRating: null },
        { trainerId: 'trainer-2', name: 'Berta', reviewCount: 0, averageRating: null },
      ]),
    };
    const repository = new ReportsRepository(prisma as never, reviews as never);

    const result = await repository.trainerPerformance(
      '2026-01-01',
      '2026-01-31',
      'rating',
      'desc',
    );

    expect(result).toEqual({ data: rows });
    expect(reviews.trainerAverages).toHaveBeenCalledWith(tx, {
      from: '2026-01-01',
      to: '2026-01-31',
    });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(query?.sql).toContain("cs.status = 'COMPLETADA'::\"SessionStatus\"");
    expect(query?.sql).toContain("AT TIME ZONE 'America/El_Salvador')::date BETWEEN");
    expect(query?.sql).not.toContain('reviews r');
    expect(query?.sql).not.toContain('cr.attendance');
    expect(query?.sql).not.toContain('r.rating');
    expect(query?.values).toContain('2026-01-01');
    expect(query?.values).toContain('2026-01-31');
  });

  it('conserva orden contractual por rating, luego sesiones y nombre', async () => {
    const tx = {
      $queryRaw: vi.fn(async () => []),
    };
    const prisma = {
      $transaction: vi.fn(async (work: (client: typeof tx) => Promise<unknown>) =>
        work(tx),
      ),
    };
    const repository = new ReportsRepository(prisma as never, {
      trainerAverages: vi.fn(async () => [
        { trainerId: 'z', name: 'Zulu', reviewCount: 1, averageRating: 4.8 },
        { trainerId: 'b', name: 'Beta', reviewCount: 2, averageRating: 4.8 },
        { trainerId: 'a', name: 'Alpha', reviewCount: 0, averageRating: 4.8 },
        { trainerId: 'n', name: 'Null', reviewCount: 0, averageRating: null },
      ]),
    } as never);

    const result = await repository.trainerPerformance(
      '2026-01-01',
      '2026-01-31',
      'rating',
      'desc',
    );

    expect(result.data.map((row) => row.trainerId)).toEqual(['a', 'b', 'z', 'n']);
  });
});
