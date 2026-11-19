import { DomainError } from '@Common/errors';
import { isCalendarDate } from '@Common/time';
import { UserRole, type User } from '@PrismaClient';
import { MAX_RANGE_DAYS, MILLISECONDS_PER_DAY } from '../limits.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** El progreso personal es de un miembro activo; otros roles quedan fuera. */
export function assertMember(user: User): void {
  if (!user?.isActive || user?.role !== UserRole.MIEMBRO) {
    throw new DomainError('FORBIDDEN', 'Acceso denegado.');
  }
}

/** El progreso de clientes es superficie exclusiva del entrenador. */
export function assertTrainer(user: User): void {
  if (!user?.isActive || user?.role !== UserRole.ENTRENADOR) {
    throw new DomainError('FORBIDDEN', 'Acceso denegado.');
  }
}

/** Defensa interna: el UUID ya lo valida la ruta, pero el servicio no admite basura. */
export function assertUuid(value: string, field: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new DomainError('INVALID', `Identificador inválido. field=${field}`);
  }
}

/** Fecha civil obligatoria en formato YYYY-MM-DD. */
export function assertCalendarDate(value: string, field: string): void {
  if (!isCalendarDate(value)) {
    throw new DomainError(
      'INVALID',
      `${field} debe ser una fecha civil válida en formato YYYY-MM-DD. field=${field}`,
    );
  }
}

/**
 * Rango civil opcional: mismo formato, orden y tope de un año (H25 y H26).
 *
 * Se comparan cadenas YYYY-MM-DD, no instantes, para que el resultado no
 * dependa de la hora UTC en la que corra la petición.
 */
export function assertCivilRange(from?: string, to?: string): void {
  if (from !== undefined) {
    assertCalendarDate(from, 'from');
  }
  if (to !== undefined) {
    assertCalendarDate(to, 'to');
  }
  if (!from || !to) {
    return;
  }
  if (from > to) {
    throw new DomainError(
      'INVALID',
      'from no puede ser posterior a to. field=from',
    );
  }
  const days = (Date.parse(to) - Date.parse(from)) / MILLISECONDS_PER_DAY + 1;
  if (days > MAX_RANGE_DAYS) {
    throw new DomainError(
      'INVALID',
      'El rango máximo admitido es de un año. field=to',
    );
  }
}

/** Convierte límites opcionales en un rango efectivo acotado por el año máximo. */
export function resolveCivilRange(from?: string, to?: string): {
  from: string | null;
  to: string | null;
} {
  assertCivilRange(from, to);
  const offset = (date: string, days: number) =>
    new Date(Date.parse(date) + days * MILLISECONDS_PER_DAY)
      .toISOString()
      .slice(0, 10);
  if (from && to) return { from, to };
  if (from) return { from, to: offset(from, MAX_RANGE_DAYS - 1) };
  if (to) return { from: offset(to, -(MAX_RANGE_DAYS - 1)), to };
  return { from: null, to: null };
}
