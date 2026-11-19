
import type { Prisma } from '@PrismaClient';
import { ReservationStatus, SessionStatus } from '@PrismaClient';
import { DomainError } from '@Common/errors';

export const CANCELLATION_LEAD_HOURS = 12;

const HOUR_IN_MS = 60 * 60 * 1000;
const CANCELLATION_LEAD_MS =
  CANCELLATION_LEAD_HOURS * HOUR_IN_MS;

export const ALREADY_CANCELLED_MESSAGE =
  'La reserva ya está cancelada';
export const CANCELLED_BY_GYM_MESSAGE =
  'El gimnasio canceló esta reserva';
export const CANCEL_WINDOW_MESSAGE =
  'La reserva solo puede cancelarse hasta 12 horas antes';
export const SESSION_CANCELLED_MESSAGE =
  'La sesión está cancelada.';
export const SESSION_NOT_BOOKABLE_MESSAGE =
  'La sesión no admite reservas en este estado.';
export const SESSION_STARTED_MESSAGE =
  'La sesión ya comenzó.';
export const DUPLICATE_RESERVATION_MESSAGE =
  'Ya tienes una reserva para esta sesión';
export const INACTIVE_RESERVATION_MESSAGE =
  'Ya existe una reserva cancelada para esta sesión y no puede reactivarse.';
export const OVERLAP_MESSAGE =
  'La sesión se solapa con otra reserva confirmada.';
export const NO_SEATS_MESSAGE =
  'La sesión no tiene plazas disponibles.';
export const NO_CREDITS_MESSAGE =
  'No tienes clases restantes para reservar.';
export const RESERVATION_NOT_FOUND_MESSAGE =
  'La reserva no existe.';

interface SessionBookability {
  status: SessionStatus;
  startsAt: Date;
}

interface ExistingReservation {
  status: ReservationStatus;
}

interface CreditState {
  creditConsumed: boolean;
  creditRefunded: boolean;
  membershipId: string | null;
}

export function assertSessionBookable(
  session: SessionBookability,
  now: Date,
): void {
  if (session.status === SessionStatus.CANCELADA) {
    throw new DomainError(
      'CONFLICT',
      SESSION_CANCELLED_MESSAGE,
    );
  }
  if (session.status !== SessionStatus.PROGRAMADA) {
    throw new DomainError(
      'CONFLICT',
      SESSION_NOT_BOOKABLE_MESSAGE,
    );
  }
  if (session.startsAt.getTime() <= now.getTime()) {
    throw new DomainError(
      'CONFLICT',
      SESSION_STARTED_MESSAGE,
    );
  }
}

export function assertReservationSlotAvailable(
  existing: ExistingReservation | null,
): void {
  if (!existing) return;

  if (existing.status === ReservationStatus.CONFIRMADA) {
    throw new DomainError(
      'CONFLICT',
      DUPLICATE_RESERVATION_MESSAGE,
    );
  }
  throw new DomainError(
    'CONFLICT',
    INACTIVE_RESERVATION_MESSAGE,
  );
}

export function hasIntervalOverlap(
  firstStartsAt: Date,
  firstEndsAt: Date,
  secondStartsAt: Date,
  secondEndsAt: Date,
): boolean {
  return (
    firstStartsAt.getTime() < secondEndsAt.getTime() &&
    firstEndsAt.getTime() > secondStartsAt.getTime()
  );
}

export function computeFreeSpots(
  capacity: number,
  confirmedCount: number,
): number {
  return Math.max(0, capacity - confirmedCount);
}

export function assertSeatsAvailable(
  capacity: number,
  confirmedCount: number,
): void {
  if (computeFreeSpots(capacity, confirmedCount) > 0) {
    return;
  }
  throw new DomainError('CONFLICT', NO_SEATS_MESSAGE);
}

export function assertCancellableByMember(
  status: ReservationStatus,
): void {
  if (status === ReservationStatus.CONFIRMADA) {
    return;
  }
  if (status === ReservationStatus.CANCELADA_POR_GIMNASIO) {
    throw new DomainError(
      'CONFLICT',
      CANCELLED_BY_GYM_MESSAGE,
    );
  }
  throw new DomainError(
    'CONFLICT',
    ALREADY_CANCELLED_MESSAGE,
  );
}

export function assertCancelWindowOpen(
  startsAt: Date,
  now: Date,
): void {
  const remainingMs =
    startsAt.getTime() - now.getTime();

  if (remainingMs >= CANCELLATION_LEAD_MS) {
    return;
  }
  throw new DomainError(
    'CONFLICT',
    CANCEL_WINDOW_MESSAGE,
  );
}

export function shouldRestoreCredit(
  reservation: CreditState,
): boolean {
  if (!reservation.membershipId) {
    return false;
  }
  return (
    reservation.creditConsumed &&
    !reservation.creditRefunded
  );
}

export type TransactionClient = Prisma.TransactionClient;

export const SESSION_NOT_FOUND_MESSAGE =
  'La sesión no existe.';
