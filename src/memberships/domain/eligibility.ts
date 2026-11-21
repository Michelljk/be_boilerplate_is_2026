import {
  MembershipStatus,
  PaymentConcept,
  PaymentStatus,
  PlanType,
} from '@PrismaClient';

/**
 * Hechos mínimos de una membresa para aplicarle la regla canónica.
 *
 * Cualquier fila que traiga estos campos (Prisma tipado o `$queryRaw` ya
 * normalizado) puede evaluarse aquí; por eso las relaciones se tipan de forma
 * estructural y no con el modelo completo de Prisma.
 */
export interface EligibilityInput {
  /** Persisted membership UUID when the query selects it (e.g. H2 search). */
  id?: string;
  startsOn: Date;
  endsOn: Date;
  creditsRemaining: number | null;
  plan: { type: string };
  payment: { status: string; memberId: string; concept: string };
  memberId: string;
}

/**
 * Los Date de una columna `@db.Date` son representaciones UTC de una fecha
 * civil, no instantes locales: se leen como texto YYYY-MM-DD.
 */
export function civilDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** El cobro que financia la membresa está PAGADO, es de membresa y es del propio miembro. */
export function isPaidMembershipCharge(value: EligibilityInput): boolean {
  const paid = value.payment.status === PaymentStatus.PAGADO;
  const membershipConcept = value.payment.concept === PaymentConcept.MEMBRESIA;
  const belongsToMember = value.payment.memberId === value.memberId;
  return paid && membershipConcept && belongsToMember;
}

/** El período ya terminó: el vencimiento es anterior al día indicado. */
export function hasExpiredOn(value: { endsOn: Date }, day: string): boolean {
  return civilDay(value.endsOn) < day;
}

/** El período todavía no ha comenzado: el inicio es posterior al día indicado. */
export function hasNotStartedOn(
  value: { startsOn: Date },
  day: string,
): boolean {
  return civilDay(value.startsOn) > day;
}

/** En un plan POR_CLASES quedarse sin créditos agota el acceso antes de la fecha. */
export function isOutOfCredits(value: {
  plan: { type: string };
  creditsRemaining: number | null;
}): boolean {
  if (value.plan.type !== PlanType.BY_CLASSES) {
    return false;
  }
  return (value.creditsRemaining ?? 0) <= 0;
}

/**
 * Regla canónica del proyecto (H1 y H14): una membresa habilita servicios el
 * día indicado sólo si su cobro MEMBRESIA está PAGADO, el día cae dentro del
 * período y, en planes POR_CLASES, quedan créditos.
 */
export function isMembershipEligible(
  value: EligibilityInput,
  today: string,
): boolean {
  if (!isPaidMembershipCharge(value)) {
    return false;
  }
  if (hasExpiredOn(value, today) || hasNotStartedOn(value, today)) {
    return false;
  }
  return !isOutOfCredits(value);
}

/**
 * Etiqueta VIGENTE/VENCIDA que devuelve H1 y que persisten las escrituras de H2
 * y el job diario de vencimientos.
 *
 * Una membresía pagada fuera de su intervalo civil (incluido un inicio futuro)
 * se etiqueta VENCIDA. La misma regla se usa para persistir el estado y evita
 * que H1 muestre VIGENTE una vigencia que todavía no habilita acceso.
 */
export function membershipStatusLabel(
  value: EligibilityInput,
  today: string,
): MembershipStatus {
  const stillUsable =
    isPaidMembershipCharge(value) &&
    !hasExpiredOn(value, today) &&
    !hasNotStartedOn(value, today) &&
    !isOutOfCredits(value);
  return stillUsable ? MembershipStatus.VIGENTE : MembershipStatus.VENCIDA;
}

/**
 * Membresa que muestra la tarjeta «Mi membresa» (H1).
 *
 * Primero la que cubre hoy; si ninguna cubre hoy, la más reciente por
 * vencimiento. Nunca se devuelven fechas inventadas: si el miembro no tiene
 * filas, el resultado es `null`.
 */
export function selectCurrentMembership<T extends EligibilityInput>(
  rows: readonly T[],
  today: string,
): T | null {
  const newestFirst = [...rows].sort((left, right) =>
    civilDay(right.endsOn).localeCompare(civilDay(left.endsOn)),
  );
  const covering = newestFirst.find((row) => isMembershipEligible(row, today));
  return covering ?? newestFirst[0] ?? null;
}
