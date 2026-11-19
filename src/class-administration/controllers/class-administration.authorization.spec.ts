import { describe, expect, it, vi } from 'vitest';
import { ROLES_KEY } from '../../auth/decorators/roles.decorator.js';
import { UserRole } from '@PrismaClient';
import { ClassAdministrationController } from './class-administration.controller.js';

describe('autorización H4/H7', () => {
  it('limita listado y detalle administrativos de sesiones a RECEPCION_ADMIN (403 para otros roles)', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, ClassAdministrationController),
    ).toEqual([UserRole.RECEPCION_ADMIN]);
  });
  it('permite a MIEMBRO obtener catálogo de salas necesario para filtro H4', () => {
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        Reflect.get(ClassAdministrationController.prototype, 'listRooms'),
      ),
    ).toEqual([UserRole.MIEMBRO, UserRole.RECEPCION_ADMIN]);
  });
  it('mantiene roles compartidos H4/H10 y envuelve entrenadores en data', async () => {
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        Reflect.get(ClassAdministrationController.prototype, 'listTrainers'),
      ),
    ).toEqual([UserRole.MIEMBRO, UserRole.RECEPCION_ADMIN]);

    const controller = new ClassAdministrationController({
      listTrainers: vi.fn().mockResolvedValue([
        {
          id: 'a0b1c2d3-e4f5-4678-9abc-def012345678',
          name: 'Ana Trainer',
        },
      ]),
    } as never);
    await expect(controller.listTrainers()).resolves.toEqual({
      data: [
        {
          id: 'a0b1c2d3-e4f5-4678-9abc-def012345678',
          name: 'Ana Trainer',
        },
      ],
    });
  });
});
