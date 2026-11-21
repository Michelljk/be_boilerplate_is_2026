import { DomainError } from '@Common/errors';

/** Código que el PDF de H14 exige en el cuerpo del 409. */
export const MEMBERSHIP_ALERT_CODE = 'MEMBRESIA_VENCIDA';

/** Mensaje literal de H14 · Backend 2. */
export const MEMBERSHIP_ALERT_MESSAGE =
  'Membresía vencida: confirma para registrar el ingreso';

/**
 * Conflicto 409 que además transporta un código de negocio.
 *
 * `DomainError` no tiene campo `code` y el filtro global sólo devuelve
 * `statusCode`, `error` y `message`; este error se resuelve en el filtro de
 * módulo (`filters/membership-alert.filter.ts`) para cumplir el contrato
 * `409 { code, message }` sin tocar `src/common`.
 */
export class MembershipAlertRequiredError extends DomainError {
  readonly code = MEMBERSHIP_ALERT_CODE;

  constructor() {
    super('CONFLICT', MEMBERSHIP_ALERT_MESSAGE);
    this.name = 'MembershipAlertRequiredError';
  }
}
