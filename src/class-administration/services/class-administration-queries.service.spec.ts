import { describe, expect, it, vi } from 'vitest';
import { ClassAdministrationService } from './class-administration.service.js';
import type { ClassAdministrationRepository } from '../repositories/class-administration.repository.js';
import { ClassAdministrationRepository as Repository } from '../repositories/class-administration.repository.js';
import { GymClock } from '@Common/time';

describe('ClassAdministrationService H7 queries', () => {
  it('aplica filtros y paginación para consulta administrativa', async () => {
    const repository = {
      listSessions: vi.fn().mockResolvedValue({ rows: [], total: 21 }),
    };
    const service = new ClassAdministrationService(
      repository as unknown as ClassAdministrationRepository,
      {} as GymClock,
    );
    const result = await service.listSessions({
      page: 3,
      pageSize: 10,
      status: 'PROGRAMADA',
      classTemplateId: 'a0b1c2d3-e4f5-4678-9abc-def012345678',
    });
    expect(result).toMatchObject({ total: 21, page: 3, pageSize: 10 });
    expect(repository.listSessions).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10, status: 'PROGRAMADA' }),
    );
  });
  it('rechaza paginación inválida', async () => {
    const service = new ClassAdministrationService(
      { listSessions: vi.fn() } as unknown as ClassAdministrationRepository,
      {} as GymClock,
    );
    await expect(
      service.listSessions({ page: 0, pageSize: 10 }),
    ).rejects.toThrow('paginación');
  });
  it('devuelve 404 de dominio para detalle inexistente', async () => {
    const service = new ClassAdministrationService(
      {
        findSessionById: vi.fn().mockResolvedValue(null),
      } as unknown as ClassAdministrationRepository,
      {} as GymClock,
    );
    await expect(
      service.getSession('a0b1c2d3-e4f5-4678-9abc-def012345678'),
    ).rejects.toThrow('La sesión no existe.');
  });

  it('actualiza solo sesiones sin ninguna reserva, no las que solo carecen de confirmadas', async () => {
    const classSession = {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
    };
    const tx = {
      $queryRaw: vi.fn(),
      classTemplate: {
        findUnique: vi.fn().mockResolvedValue({ id: 'template-id' }),
        update: vi.fn().mockResolvedValue({ id: 'template-id' }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({
          role: 'ENTRENADOR',
          isActive: true,
        }),
      },
      room: { findUnique: vi.fn().mockResolvedValue({ capacity: 20 }) },
      classSession,
    };
    const prisma = {
      $transaction: vi.fn(async (work: (transaction: typeof tx) => unknown) =>
        work(tx),
      ),
    };
    const repository = new Repository(
      prisma as never,
      {} as GymClock,
      {} as never,
    );

    await repository.updateTemplate(
      'template-id',
      {
        name: 'Yoga',
        trainerId: 'trainer-id',
        roomId: 'room-id',
        weekday: 1,
        startTime: '09:00',
        durationMinutes: 60,
        capacity: 10,
      },
      new Date('2030-01-01T00:00:00Z'),
    );

    expect(classSession.findMany).toHaveBeenCalledWith({
      where: {
        classTemplateId: 'template-id',
        startsAt: { gt: new Date('2030-01-01T00:00:00Z') },
        status: 'PROGRAMADA',
        reservations: { none: {} },
      },
    });
    expect(classSession.update).not.toHaveBeenCalled();
  });
});
