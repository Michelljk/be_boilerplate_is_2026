
import type {
  EvolutionView,
} from '../dto/evolution-response.dto.js';

import type {
  ProgressMetric,
} from '../dto/evolution-query.dto.js';

export type EvolutionPoint = EvolutionView['points'][number];

/**
 * H25: calcula la evolución de las mediciones.
 *
 * Recibe puntos reales, sin inventar valores
 * para fechas que no tienen una medición.
 */
export function calculateEvolution(
  metric: ProgressMetric,
  points: EvolutionPoint[],
): EvolutionView {
  const unit: 'kg' | 'cm' =
    metric === 'weightKg' ||
    metric === 'exerciseWeightKg'
      ? 'kg'
      : 'cm';

  // Ordenar cronológicamente.
  const sorted = [...points].sort(
    (a, b) => a.date.localeCompare(b.date),
  );

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const baseline = first?.value ?? null;
  const latest = last?.value ?? null;

  // Se necesitan al menos dos mediciones.
  const difference =
    sorted.length >= 2 &&
    baseline !== null &&
    latest !== null
      ? Number((latest - baseline).toFixed(2))
      : null;

  return {
    metric,
    unit,
    points: sorted,
    baseline,
    latest,
    difference,
    count: sorted.length,
  };
}
