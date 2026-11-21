import type { ProgressMetric } from './progress-metrics.js';

/**
 * Modelos de lectura del dominio de progreso.
 *
 * Los repositorios devuelven estas formas ya convertidas (decimal a número y
 * fecha civil a `YYYY-MM-DD`) para que el servicio y los DTO hablen del mismo
 * idioma y nadie vuelva a interpretar un `Date` de UTC a mano.
 */

export interface ProgressMarkView {
  exerciseId: string;
  weightKg: number;
  reps: number;
}

export interface ProgressRecordView {
  id: string;
  recordDate: string;
  weightKg: number;
  waistCm: number | null;
  chestCm: number | null;
  armCm: number | null;
  isBaseline: boolean;
  marks: ProgressMarkView[];
}

export interface ProgressHistoryPage {
  rows: ProgressRecordView[];
  total: number;
  page: number;
  pageSize: number;
}

/** Punto de una serie temporal; `reps` solo existe en marcas de ejercicio. */
export interface EvolutionPoint {
  date: string;
  value: number;
  reps: number | null;
}

export interface EvolutionView {
  metric: ProgressMetric;
  unit: 'kg' | 'cm';
  points: EvolutionPoint[];
  baseline: number | null;
  latest: number | null;
  difference: number | null;
  count: number;
}

/** Resumen de peso que devuelve la ficha de cliente de H26. */
export interface WeightSummary {
  baseline: number | null;
  latest: number | null;
  difference: number | null;
}

export interface TrainerMemberView {
  memberId: string;
  memberNumber: string | null;
  memberName: string;
}

export interface TrainerMemberPage {
  rows: TrainerMemberView[];
  total: number;
  page: number;
  pageSize: number;
}

/** Registro resumido tal como lo ve el entrenador (campo `date`, no id). */
export interface MemberProgressRecord {
  date: string;
  weightKg: number;
  waistCm: number | null;
  chestCm: number | null;
  armCm: number | null;
  marks: ProgressMarkView[];
}

export interface MemberProgressView {
  memberId: string;
  records: MemberProgressRecord[];
  evolution: WeightSummary;
}

/** Rango civil ya validado, con extremos opcionales. */
export interface CivilRange {
  from: string | null;
  to: string | null;
}
