import { DomainError } from '@Common/errors';
import { PlanStatus, PlanType } from '@PrismaClient';

/** Plan completo tras mezclar el PATCH con la fila existente. */
export interface PlanDraft {
  name: string;
  type: PlanType;
  priceUsd: string;
  durationMonths: number | null;
  durationDays: number | null;
  classCredits: number | null;
  benefits: string[];
  status: PlanStatus;
}

const MONTHS_BY_TYPE: Record<string, number> = {
  [PlanType.MONTHLY]: 1,
  [PlanType.QUARTERLY]: 3,
};

function isBlank(value: number | null): boolean {
  return value === null || value === undefined;
}

function assertPrice(priceUsd: string): void {
  const price = Number(priceUsd);
  if (!Number.isFinite(price) || price < 0) {
    throw new DomainError(
      'INVALID',
      'El precio del plan debe ser mayor o igual a cero.',
    );
  }
}

function assertCalendarDuration(draft: PlanDraft, expected: number): void {
  const wrongShape =
    draft.durationMonths !== expected ||
    !isBlank(draft.durationDays) ||
    !isBlank(draft.classCredits);
  if (wrongShape) {
    const label = expected === 1 ? 'mensual' : 'trimestral';
    throw new DomainError(
      'INVALID',
      `Un plan ${label} debe durar exactamente ${expected} mes${expected === 1 ? '' : 'es'}.`,
    );
  }
}

function assertByClassesDuration(draft: PlanDraft): void {
  const days = draft.durationDays ?? 0;
  const credits = draft.classCredits ?? 0;
  const wrongShape =
    !isBlank(draft.durationMonths) ||
    !Number.isInteger(days) ||
    days < 1 ||
    !Number.isInteger(credits) ||
    credits < 1;
  if (wrongShape) {
    throw new DomainError(
      'INVALID',
      'Un plan por clases requiere al menos 1 crédito y 1 día de validez.',
    );
  }
}

/** Normaliza los textos del plan para que el catálogo no guarde huecos. */
export function normalizePlanDraft(draft: PlanDraft): PlanDraft {
  const benefits = draft.benefits
    .map((benefit) => benefit.trim())
    .filter((benefit) => benefit.length > 0);
  return { ...draft, name: draft.name.trim(), benefits };
}

/**
 * Reglas de H3 (criterios 2 y 3) más la forma que exige la restricción CHECK de
 * `membership_plans`: los planes calendario van en meses y los POR_CLASES
 * combinan créditos con días de validez.
 */
export function assertValidPlan(input: PlanDraft): PlanDraft {
  const draft = normalizePlanDraft(input);
  if (draft.name.length < 3 || draft.name.length > 80) {
    throw new DomainError(
      'INVALID',
      'El nombre del plan debe tener entre 3 y 80 caracteres después de quitar espacios.',
    );
  }
  assertPrice(draft.priceUsd);
  const calendarMonths = MONTHS_BY_TYPE[draft.type];
  if (calendarMonths !== undefined) {
    assertCalendarDuration(draft, calendarMonths);
    return draft;
  }
  if (draft.type === PlanType.BY_CLASSES) {
    assertByClassesDuration(draft);
    return draft;
  }
  throw new DomainError('INVALID', 'El tipo de plan no es reconocido.');
}

/** Un plan inactivable nunca borra ni invalida membresas: sólo cambia su estado. */
export function assertPlanStatus(status: string): void {
  const known = Object.values(PlanStatus) as string[];
  if (!known.includes(status)) {
    throw new DomainError('INVALID', 'Estado de plan inválido.');
  }
}
