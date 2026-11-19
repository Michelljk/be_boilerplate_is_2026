import { DomainError } from '@Common/errors';
import { addDays, isCalendarDate } from '@Common/time';

/** Días por defecto cuando el historial no trae rango (H15 · Frontend 2). */
export const DEFAULT_HISTORY_DAYS = 30;

/** Máximo de días admitidos en un rango (H15 · Backend 1). */
export const MAX_HISTORY_RANGE_DAYS = 90;

/** Tamaño de página por defecto y máximo exigido por H15. */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 20;

export const INVERTED_RANGE_MESSAGE =
  'La fecha inicial no puede ser posterior a la final';

export const TOO_WIDE_RANGE_MESSAGE = `El rango no puede superar ${MAX_HISTORY_RANGE_DAYS} días.`;

export interface HistoryRange {
  readonly from: string;
  readonly to: string;
}

/**
 * Resuelve el rango civil del historial.
 *
 * Sin `from` ni `to` se devuelven los últimos 30 días del gimnasio, incluyendo
 * el día de hoy. Valida formato, rango invertido y el tope de 90 días.
 */
export function resolveHistoryRange(
  query: { from?: string; to?: string },
  today: string,
): HistoryRange {
  const to = query.to ?? today;
  const from = query.from ?? addDays(to, -(DEFAULT_HISTORY_DAYS - 1));

  assertCalendarDay('from', from);
  assertCalendarDay('to', to);

  if (from > to) {
    throw new DomainError('INVALID', INVERTED_RANGE_MESSAGE);
  }

  if (rangeLengthDays(from, to) > MAX_HISTORY_RANGE_DAYS) {
    throw new DomainError('INVALID', TOO_WIDE_RANGE_MESSAGE);
  }

  return { from, to };
}

/** Cantidad de días civiles inclusivos entre dos fechas `YYYY-MM-DD`. */
export function rangeLengthDays(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  const millisecondsPerDay = 86_400_000;

  return Math.round((end - start) / millisecondsPerDay) + 1;
}

/** Normaliza el filtro por número de miembro; vacío significa «sin filtro». */
export function normalizeMemberNumber(
  memberNumber?: string,
): string | undefined {
  const trimmed = memberNumber?.trim();

  return trimmed ? trimmed : undefined;
}

function assertCalendarDay(field: string, value: string): void {
  if (!isCalendarDate(value)) {
    throw new DomainError(
      'INVALID',
      `${field} debe ser una fecha civil válida con formato YYYY-MM-DD.`,
    );
  }
}
