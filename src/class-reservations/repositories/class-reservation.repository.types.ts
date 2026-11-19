import type { ReservationStatus } from '@PrismaClient';

/** Fila confirmada devuelta por H5; las fechas salen como instante UTC. */
export interface CreatedClassReservation {
  id: string;
  sessionId: string;
  className: string;
  startsAt: Date;
  endsAt: Date;
  status: ReservationStatus;
  createdAt: Date;
}

export interface ListedClassReservation {
  id: string;
  className: string;
  trainerName: string;
  roomName: string;
  startsAt: Date;
  endsAt: Date;
  status: ReservationStatus;
}

export interface ClassReservationSnapshot {
  rows: ListedClassReservation[];
  total: number;
}

/** Resultado de H6; freeSpots se calcula con la sesión padre bloqueada. */
export interface CancelledClassReservation {
  id: string;
  status: ReservationStatus;
  cancelledAt: Date;
  freeSpots: number;
}

export interface ClassReservationListOptions {
  status?: ReservationStatus;
  skip: number;
  take: number;
}


