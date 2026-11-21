import { DomainError } from '@Common/errors';
import { UserRole, type User } from '@PrismaClient';

/**
 * H13 · Backend 3 y H15 · Backend 2: el control de accesos es exclusivo de
 * recepción y administración. El guard global ya devuelve 403 por rol, pero el
 * dominio lo reafirma para que ninguna llamada interna salte la restricción.
 */
export function assertReceptionAdmin(actor: User): void {
  if (actor.role !== UserRole.RECEPCION_ADMIN) {
    throw new DomainError(
      'FORBIDDEN',
      'Solo recepción puede registrar o consultar ingresos.',
    );
  }
}
