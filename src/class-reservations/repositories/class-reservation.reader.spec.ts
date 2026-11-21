import { describe, expect, it, vi } from 'vitest';
import { ClassReservationReader } from './class-reservation.reader.js';

describe('ClassReservationReader', () => {
  it('proyecta entrenador y sala de la sesión, no de la plantilla', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'reservation-id',
        status: 'CONFIRMADA',
        session: {
          startsAt: new Date('2026-11-20T15:00:00.000Z'),
          endsAt: new Date('2026-11-20T16:00:00.000Z'),
          classTemplate: { name: 'Yoga' },
          trainer: { profile: { fullName: 'Entrenador actual' } },
          room: { name: 'Sala actual' },
        },
      },
    ]);
    const prisma = {
      classReservation: {
        count: vi.fn().mockResolvedValue(1),
        findMany,
      },
    };

    const reader = new ClassReservationReader(prisma as never);
    const result = await reader.listMine('member-id', {
      skip: 0,
      take: 10,
    });

    expect(result.rows[0]).toMatchObject({
      trainerName: 'Entrenador actual',
      roomName: 'Sala actual',
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          session: expect.objectContaining({
            select: expect.objectContaining({
              trainer: expect.any(Object),
              room: expect.any(Object),
            }),
          }),
        }),
      }),
    );
  });
});
