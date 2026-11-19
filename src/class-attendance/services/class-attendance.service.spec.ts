import { describe, expect, it, vi } from 'vitest';
import { DomainError } from '@Common/errors';
import { UserRole } from '@PrismaClient';
import { ClassAttendanceService } from './class-attendance.service.js';

const trainer = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  role: UserRole.ENTRENADOR,
} as never;
const member = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  role: UserRole.MIEMBRO,
} as never;
const sessionId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function setup() {
  const repository = {
    attendees: vi.fn(),
    advanceDueSessions: vi.fn(),
    updateAttendance: vi.fn(),
    complete: vi.fn(),
  };
  const clock = { now: () => new Date('2026-11-11T18:00:00Z') };
  return {
    service: new ClassAttendanceService(repository as never, clock as never),
    repository,
  };
}

describe('ClassAttendanceService H8', () => {
  it('permite consultar asistentes al entrenador autenticado y aplica paginación', async () => {
    const { service, repository } = setup();
    repository.attendees.mockResolvedValue({ data: [], total: 0 });
    await service.attendees(trainer, sessionId, { page: 2, pageSize: 10 });
    expect(repository.attendees).toHaveBeenCalledWith(
      sessionId,
      trainer.id,
      2,
      10,
      new Date('2026-11-11T18:00:00Z'),
    );
  });

  it('rechaza miembros u otros roles antes de consultar el repositorio', () => {
    const { service, repository } = setup();
    expect(() =>
      service.attendees(member, sessionId, { page: 1, pageSize: 10 }),
    ).toThrow(DomainError);
    expect(repository.attendees).not.toHaveBeenCalled();
  });

  it('rechaza UUID y límites de paginación inválidos', () => {
    const { service, repository } = setup();
    expect(() =>
      service.attendees(trainer, 'bad', { page: 1, pageSize: 10 }),
    ).toThrow(DomainError);
    expect(() =>
      service.attendees(trainer, sessionId, { page: 0, pageSize: 10 }),
    ).toThrow(DomainError);
    expect(() =>
      service.attendees(trainer, sessionId, { page: 1, pageSize: 101 }),
    ).toThrow(DomainError);
    expect(repository.attendees).not.toHaveBeenCalled();
  });

  it('rechaza PENDIENTE como marca enviada y solo permite ASISTIO/NO_ASISTIO', () => {
    const { service, repository } = setup();
    expect(() =>
      service.updateAttendance(trainer, sessionId, {
        attendance: 'PENDIENTE',
      } as never),
    ).toThrow(DomainError);
    expect(repository.updateAttendance).not.toHaveBeenCalled();
  });
});
