import { DomainError } from '@Common/errors';
import { addDays } from '@Common/time';
import { MembershipStatus, PlanType } from '@PrismaClient';
import {
  civilDay,
  hasExpiredOn,
  hasNotStartedOn,
  isOutOfCredits,
  type EligibilityInput,
} from './eligibility.js';

/** Duración de un plan tal como la describe el PDF: meses, días o créditos. */
export interface PlanDuration {
  type: PlanType;
  durationMonths: number | null;
  durationDays: number | null;
  classCredits: number | null;
}

/** Período expresado con fechas civiles YYYY-MM-DD. */
export interface MembershipPeriod {
  startsOn: string;
  endsOn: string;
  creditsRemaining: number | null;
}

function dateOf(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

/** Suma meses calendáricos a una fecha civil, recortando al último día del mes. */
export function addMonthsCivil(day: string, months: number): string {
  const origin = dateOf(day);
  const firstOfMonth = new Date(
    Date.UTC(origin.getUTCFullYear(), origin.getUTCMonth() + months, 1),
  );
  const lastDayOfTarget = new Date(
    Date.UTC(firstOfMonth.getUTCFullYear(), firstOfMonth.getUTCMonth() + 1, 0),
  ).getUTCDate();
  firstOfMonth.setUTCDate(Math.min(origin.getUTCDate(), lastDayOfTarget));
  return civilDay(firstOfMonth);
}

function positiveMonths(plan: PlanDuration): number {
  const months = plan.durationMonths ?? 0;
  if (!Number.isInteger(months) || months < 1) {
    throw new DomainError(
      'INVALID',
      'El plan no tiene una duración en meses válida.',
    );
  }
  return months;
}

function positiveDays(plan: PlanDuration): number {
  const days = plan.durationDays ?? 0;
  if (!Number.isInteger(days) || days < 1) {
    throw new DomainError(
      'INVALID',
      'El plan no tiene días de validez válidos.',
    );
  }
  return days;
}

function positiveCredits(plan: PlanDuration): number {
  const credits = plan.classCredits ?? 0;
  if (!Number.isInteger(credits) || credits < 1) {
    throw new DomainError(
      'INVALID',
      'El plan por clases no tiene créditos válidos.',
    );
  }
  return credits;
}

function isByClasses(plan: PlanDuration): boolean {
  return plan.type === PlanType.BY_CLASSES;
}

/** Vencimiento del período que arranca en `startsOn` según la duración del plan. */
export function periodEnd(startsOn: string, plan: PlanDuration): string {
  if (isByClasses(plan)) {
    return addDays(startsOn, positiveDays(plan) - 1);
  }
  return addDays(addMonthsCivil(startsOn, positiveMonths(plan)), -1);
}

/** Créditos con los que nace el período; sólo los planes POR_CLASES los usan. */
export function periodCredits(plan: PlanDuration): number | null {
  return isByClasses(plan) ? positiveCredits(plan) : null;
}

/** Período de un alta nueva: arranca en la fecha de confirmación del cobro. */
export function newPeriod(
  startsOn: string,
  plan: PlanDuration,
): MembershipPeriod {
  return {
    startsOn,
    endsOn: periodEnd(startsOn, plan),
    creditsRemaining: periodCredits(plan),
  };
}

/**
 * Período resultante de renovar (H2, criterios 7, 8 y 9).
 *
 * - Si la membresía aún cubre `today`, el nuevo tramo arranca al día siguiente
 *   del vencimiento actual.
 * - Si está vencida, futura o no hay membresía previa, el tramo arranca en
 *   `today`; el servicio trata agotamiento de créditos como vencimiento.
 * - En planes POR_CLASES los créditos se reemplazan por los del plan contratado
 *   (política de reemplazo, no de acumulación).
 */
export function renewalPeriod(
  current: { startsOn: Date; endsOn: Date } | null,
  plan: PlanDuration,
  today: string,
): MembershipPeriod {
  if (
    !current ||
    hasExpiredOn(current, today) ||
    hasNotStartedOn(current, today)
  ) {
    return newPeriod(today, plan);
  }
  const nextTermStart = addDays(civilDay(current.endsOn), 1);
  return newPeriod(nextTermStart, plan);
}

/**
 * Estado que corresponde persistir a un período recién escrito con cobro PAGADO.
 * Reutiliza los predicados canónicos en lugar de duplicar la regla.
 */
export function periodStatus(
  period: MembershipPeriod,
  plan: PlanDuration,
  today: string,
): MembershipStatus {
  const facts = {
    endsOn: dateOf(period.endsOn),
    creditsRemaining: period.creditsRemaining,
    plan: { type: plan.type },
  } satisfies Pick<EligibilityInput, 'endsOn' | 'creditsRemaining' | 'plan'>;
  const expired = hasExpiredOn(facts, today);
  const exhausted = isOutOfCredits(facts);
  return expired || exhausted
    ? MembershipStatus.VENCIDA
    : MembershipStatus.VIGENTE;
}
