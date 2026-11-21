import { describe, expect, it } from 'vitest';
import { UserRole } from '../../generated/prisma/client.js';
import { ROLES_KEY } from '../../auth/decorators/roles.decorator.js';
import { MachineQueriesController } from './machine-queries.controller.js';

describe('MachineQueriesController roles H28', () => {
  it('permits only MIEMBRO and RECEPCION_ADMIN to read availability', () => {
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        Reflect.get(MachineQueriesController.prototype, 'list'),
      ),
    ).toEqual([UserRole.MIEMBRO, UserRole.RECEPCION_ADMIN]);
  });
});
