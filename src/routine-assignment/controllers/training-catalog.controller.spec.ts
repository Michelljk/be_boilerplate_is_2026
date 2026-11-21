import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '@PrismaClient';
import { ROLES_KEY } from '@Auth/decorators';
import { TrainingCatalogController } from './training-catalog.controller.js';

describe('TrainingCatalogController roles (H22/H24/H25)', () => {
  it('permite sólo al entrenador y al miembro leer el catálogo', () => {
    expect(Reflect.getMetadata(ROLES_KEY, TrainingCatalogController)).toEqual([
      UserRole.ENTRENADOR,
      UserRole.MIEMBRO,
    ]);
    expect(
      Reflect.getMetadata(ROLES_KEY, TrainingCatalogController),
    ).not.toContain(UserRole.RECEPCION_ADMIN);
  });

  it('expone una consulta paginada de solo lectura', async () => {
    const service = {
      exercises: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    };
    const controller = new TrainingCatalogController(service as never);
    const query = { page: 2, pageSize: 5 };

    await expect(controller.exercises(query)).resolves.toEqual({
      data: [],
      total: 0,
    });
    expect(service.exercises).toHaveBeenCalledOnce();
    expect(service.exercises).toHaveBeenCalledWith(2, 5);
    expect(Object.keys(controller)).not.toContain('create');
    expect(Object.keys(controller)).not.toContain('update');
  });
});
