import { PaymentConcept, Prisma } from '@PrismaClient';

/** Monto fijo del cobro de una sesión personal (H10 · criterio 4). */
export const SESSION_AMOUNT_USD = new Prisma.Decimal('10.00');

/** Concepto contable del cobro creado al agendar (H10 · criterio 4). */
export const SESSION_CHARGE_CONCEPT: PaymentConcept =
  PaymentConcept.SESION_PERSONAL;

/** Motivo que queda registrado cuando la cancelación anula el cobro (H11). */
export const SESSION_CHARGE_VOID_REASON = 'Cancelación de sesión personal';

/** Ventana civil en la que un miembro puede agendar (H10 · criterio 1). */
export const BOOKING_WINDOW_DAYS = 15;

/** Antelación mínima para cancelar (H11 · criterio 1). */
export const CANCELLATION_LEAD_HOURS = 12;

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const HOUR_IN_MS = 60 * 60 * 1000;

/** Último instante agendable: ahora más 15 días. */
export function bookingWindowEnd(now: Date): Date {
  return new Date(now.getTime() + BOOKING_WINDOW_DAYS * DAY_IN_MS);
}

/** El inicio más temprano que todavía admite cancelación: ahora más 12 horas. */
export function cancellationDeadline(now: Date): Date {
  return new Date(now.getTime() + CANCELLATION_LEAD_HOURS * HOUR_IN_MS);
}
