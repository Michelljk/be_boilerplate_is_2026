import { describe, expect, it } from 'vitest';
import { UserRole } from '../../generated/prisma/client.js';
import { ROLES_KEY } from '../../auth/decorators/roles.decorator.js';
import { MachineAdministrationController } from './machine-administration.controller.js';

describe('MachineAdministrationController roles H27', () => {
  it('restricts history and every mutation to RECEPCION_ADMIN', () => {
    for (const method of [
      'listMaintenanceHistory',
      'openMaintenance',
      'completeMaintenance',
      'changeStatus',
    ]) {
      expect(
        Reflect.getMetadata(
          ROLES_KEY,
          Reflect.get(MachineAdministrationController.prototype, method),
        ),
      ).toEqual([UserRole.RECEPCION_ADMIN]);
    }
  });
});
