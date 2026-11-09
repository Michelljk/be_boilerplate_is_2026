import type { ReservationStatus } from '@PrismaClient';

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
