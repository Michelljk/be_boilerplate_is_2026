import { describe, expect, it, vi } from 'vitest';
import { ClassQueriesService } from './class-queries.service.js';
import type { ClassSessionRepository } from '../repositories/class-session.repository.js';
import { GymClock } from '@Common/time';

describe('ClassQueriesService H4', () => {
  it('aplica filtros de clase/sala/entrenador y ventana exacta de siete días con paginación', async () => {
    const repo = {
      findAvailableSnapshot: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    };
    const clock = {
      dateOnly: (value: string) => new Date(`${value}T00:00:00Z`),
      now: () => new Date('2026-11-11T18:30:00.000Z'),
    } as GymClock;
    const service = new ClassQueriesService(
      repo as unknown as ClassSessionRepository,
      clock,
    );
    const query = {
      from: '2026-11-09',
      to: '2026-11-15',
      name: ' spin ',
      roomId: 'a0b1c2d3-e4f5-4678-9abc-def012345678',
      trainerId: 'b0b1c2d3-e4f5-4678-9abc-def012345678',
      page: 2,
      pageSize: 5,
    } as never;
    await service.findSessions(query);
    expect(repo.findAvailableSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        from: new Date('2026-11-09T06:00:00Z'),
        toExclusive: new Date('2026-11-16T06:00:00Z'),
        notStartedAfter: new Date('2026-11-11T18:30:00.000Z'),
        name: 'spin',
        roomId: query.roomId,
        trainerId: query.trainerId,
        skip: 5,
        take: 5,
      }),
    );
  });
  it('rechaza rango no consecutivo de siete días', async () => {
    const service = new ClassQueriesService(
      { findAvailableSnapshot: vi.fn() } as unknown as ClassSessionRepository,
      {} as GymClock,
    );
    await expect(
      service.findSessions({ from: '2026-11-09', to: '2026-11-14' } as never),
    ).rejects.toThrow('exactamente siete días');
  });
});
