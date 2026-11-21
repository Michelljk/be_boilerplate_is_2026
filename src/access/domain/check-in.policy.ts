import { DomainError } from '@Common/errors';
import { CheckInMembershipStatus } from '@PrismaClient';
import { MembershipAlertRequiredError } from './membership-alert.error.js';

/** Mensaje literal de H13 · Backend 1 y 3. */
export const DUPLICATE_CHECK_IN_MESSAGE =
  'El miembro ya registró su ingreso hoy';

/** Mensaje literal de H13 · Backend 2. */
export const MEMBER_NOT_FOUND_MESSAGE = 'No se encontró al miembro';

/** Motivo de rechazo ya tipado; el filtro de módulo lo traduce a HTTP. */
export type CheckInRejection = 'ALREADY_CHECKED_IN' | 'MEMBERSHIP_ALERT';

export type CheckInDecision =
  | {
      readonly allowed: true;
      readonly expiredConfirmed: boolean;
    }
  | {
      readonly allowed: false;
      readonly rejection: CheckInRejection;
      readonly error: DomainError;
    };

export interface CheckInFacts {
  readonly membershipStatus: CheckInMembershipStatus;
  readonly alreadyCheckedInToday: boolean;
  readonly confirmExpired: boolean;
}

/**
 * Reglas puras de H13 y H14, sin I/O, para poder probarlas por separado.
 *
 * 1. H13: un solo ingreso por miembro por día calendario. Esta regla tiene
 *    precedencia sobre cualquier alerta de membresía: todo segundo intento
 *    devuelve el mensaje literal de duplicado, incluso si no confirma H14.
 * 2. H14: una membresía no vigente exige confirmación explícita de recepción
 *    antes de permitir el acceso; se rechaza con 409 y código
 *    `MEMBRESIA_VENCIDA` cuando todavía no existe un ingreso ese día.
 */
export function evaluateCheckIn(facts: CheckInFacts): CheckInDecision {
  const isExpired = facts.membershipStatus !== CheckInMembershipStatus.VIGENTE;

  if (facts.alreadyCheckedInToday) {
    return {
      allowed: false,
      rejection: 'ALREADY_CHECKED_IN',
      error: new DomainError('CONFLICT', DUPLICATE_CHECK_IN_MESSAGE),
    };
  }

  if (isExpired && !facts.confirmExpired) {
    return {
      allowed: false,
      rejection: 'MEMBERSHIP_ALERT',
      error: new MembershipAlertRequiredError(),
    };
  }

  return { allowed: true, expiredConfirmed: isExpired };
}
