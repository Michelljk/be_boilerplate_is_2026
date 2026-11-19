/**
 * Catálogo de indicadores que admite la evolución física (H25) y utilidades
 * deterministas sobre ellos. Es dominio puro: no conoce HTTP ni Prisma.
 */

export const PROGRESS_METRICS = [
  'weightKg',
  'waistCm',
  'chestCm',
  'armCm',
  'exerciseWeightKg',
] as const;

export type ProgressMetric = (typeof PROGRESS_METRICS)[number];

/** Indicadores que viven como columna de `ProgressRecord`. */
export const BODY_METRICS = [
  'weightKg',
  'waistCm',
  'chestCm',
  'armCm',
] as const satisfies readonly ProgressMetric[];

export type BodyMetric = (typeof BODY_METRICS)[number];

/** La métrica de marcas exige `exerciseId` obligatorio (contrato H25). */
export const EXERCISE_METRIC: ProgressMetric = 'exerciseWeightKg';

export function isProgressMetric(value: unknown): value is ProgressMetric {
  return (
    typeof value === 'string' &&
    (PROGRESS_METRICS as readonly string[]).includes(value)
  );
}

export function isBodyMetric(value: ProgressMetric): value is BodyMetric {
  return (BODY_METRICS as readonly string[]).includes(value);
}

export function metricUnit(metric: ProgressMetric): 'kg' | 'cm' {
  if (metric === EXERCISE_METRIC || metric === 'weightKg') {
    return 'kg';
  }
  return 'cm';
}

/**
 * Diferencia entre el último y el primer punto medible.
 *
 * Las columnas son `DECIMAL(6,2)`; se redondea a dos cifras para que la resta
 * en coma flotante no publique ruido tipo `0.30000000000000004`.
 */
export function roundToTwoDecimals(value: number): number {
  return Number(value.toFixed(2));
}
