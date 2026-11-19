import { Prisma } from '@PrismaClient';
import { describe, expect, it, vi } from 'vitest';
import { ReviewsRepository } from './reviews.repository.js';

describe('ReviewsRepository.trainerAverages', () => {
  it('comparte la agregación H30 y H39 y aplica el rango civil solo cuando se solicita', async () => {
    const queries: Prisma.Sql[] = [];
    const prisma = {
      $queryRaw: vi.fn(async (query: Prisma.Sql) => {
        queries.push(query);
        return [
          { trainerId: 'trainer-1', name: 'Ana', reviewCount: 2, averageRating: 4.5 },
          { trainerId: 'trainer-2', name: 'Berta', reviewCount: 0, averageRating: null },
        ];
      }),
    };
    const repository = new ReviewsRepository(prisma as never);

    const h30 = await repository.trainerAverages();
    const h39 = await repository.trainerAverages(undefined, {
      from: '2026-01-01',
      to: '2026-01-31',
    });

    expect(h30).toEqual(h39);
    expect(h30[1]).toMatchObject({ reviewCount: 0, averageRating: null });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(queries[0].sql).toContain('ROUND(SUM(r.rating)::numeric / COUNT(r.id), 1)');
    expect(queries[1].sql).toContain('ROUND(SUM(r.rating)::numeric / COUNT(r.id), 1)');
    for (const query of queries) {
      expect(query.sql).toContain("cs.status = 'COMPLETADA'::\"SessionStatus\"");
      expect(query.sql).toContain("cr.attendance = 'ASISTIO'::\"AttendanceStatus\"");
      expect(query.sql).toContain('r.rating BETWEEN 1 AND 5');
      expect(query.sql).toContain('LEFT JOIN scores s ON s.entity_id = e.entity_id');
    }
    expect(queries[0].sql).not.toContain('AT TIME ZONE');
    expect(queries[1].sql).toContain("AT TIME ZONE 'America/El_Salvador')::date BETWEEN");
    expect(queries[1].values).toContain('2026-01-01');
    expect(queries[1].values).toContain('2026-01-31');
  });
});
