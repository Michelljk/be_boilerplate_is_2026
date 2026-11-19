import { describe, expect, it, vi } from 'vitest';
import { ReservationStatus, SessionStatus } from '@PrismaClient';
import { ClassSessionRepository } from './class-session.repository.js';
import type { PrismaService } from '@Prisma/services';

describe('ClassSessionRepository H4', () => {
  it('consulta solo sesiones PROGRAMADA estrictamente futuras dentro de la ventana y cuenta reservas confirmadas', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const tx = { classSession: { findMany, count } };
    const prisma = {
      $transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const repository = new ClassSessionRepository(
      prisma as unknown as PrismaService,
    );
    const query = {
      from: new Date('2026-11-09T06:00:00.000Z'),
      toExclusive: new Date('2026-11-16T06:00:00.000Z'),
      notStartedAfter: new Date('2026-11-11T18:30:00.000Z'),
      skip: 0,
      take: 10,
    };

    await repository.findAvailableSnapshot(query);

    const where = {
      startsAt: {
        gte: query.from,
        gt: query.notStartedAfter,
        lt: query.toExclusive,
      },
      status: { equals: SessionStatus.PROGRAMADA },
    };
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where,
        orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
        skip: 0,
        take: 10,
        select: expect.objectContaining({
          _count: {
            select: {
              reservations: { where: { status: ReservationStatus.CONFIRMADA } },
            },
          },
        }),
      }),
    );
    expect(count).toHaveBeenCalledWith({ where });
  });
});
