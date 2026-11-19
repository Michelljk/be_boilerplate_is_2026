import { PersonalSessionStatus } from '@PrismaClient';
import type { PaymentStatus, SlotStatus } from '@PrismaClient';

/** Espacio LIBRE del catálogo de horarios de un entrenador (H10). */
export interface TrainerSlotOption {
  id: string;
  startsAt: Date;
  endsAt: Date;
}

/** Cobro asociado a una sesión personal. */
export interface SessionPaymentRecord {
  id: string;
  amountUsd: number;
  status: PaymentStatus;
}

/** Fila de «Mis sesiones» (H10). */
export interface PersonalSessionRecord {
  id: string;
  trainerName: string;
  startsAt: Date;
  endsAt: Date;
  status: PersonalSessionStatus;
}

/** Sesión confirmada con su cobro (respuesta 201 de H10). */
export interface BookedSessionRecord extends PersonalSessionRecord {
  payment: SessionPaymentRecord;
}

export interface PersonalSessionPageRecord {
  items: PersonalSessionRecord[];
  total: number;
}

/** Resultado de la cancelación (respuesta 200 de H11). */
export interface CancelledSessionRecord {
  id: string;
  /** Literal estrecho: la respuesta de H11 siempre devuelve CANCELADA. */
  status: (typeof PersonalSessionStatus)['CANCELADA'];
  cancelledAt: Date;
  slotStatus: SlotStatus;
  paymentStatus: PaymentStatus | null;
}

/** Entrada del caso de uso «agendar sesión personal» (H10). */
export interface BookSlotInput {
  memberId: string;
  slotId: string;
  now: Date;
  windowEnd: Date;
  today: string;
}

/** Entrada del caso de uso «cancelar sesión personal» (H11). */
export interface CancelSessionInput {
  memberId: string;
  sessionId: string;
  now: Date;
  earliestStartsAt: Date;
}

/** Entrada del caso de uso «mis sesiones» (H10). */
export interface ListMineInput {
  memberId: string;
  status?: PersonalSessionStatus;
  skip: number;
  take: number;
}

/** Entrada del caso de uso «espacios libres» (H10). */
export interface ListFreeSlotsInput {
  trainerId: string;
  from: Date;
  until: Date;
}

/** Fila bloqueada de `trainer_slots` dentro de la transacción de reserva. */
export interface LockedSlot {
  id: string;
  trainerId: string;
  startsAt: Date;
  endsAt: Date;
  status: SlotStatus;
}

/** Fila bloqueada de `personal_sessions` dentro de la transacción de cancelación. */
export interface LockedSession {
  id: string;
  slotId: string;
  startsAt: Date;
  status: PersonalSessionStatus;
  paymentId: string | null;
}
