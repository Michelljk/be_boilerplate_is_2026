
/**
 * H8 — Contratos de persistencia para el registro
 * de asistencia a sesiones grupales.
 *
 * Estos tipos no dependen directamente de Prisma.
 */

export type AttendanceValue =
  | 'PENDIENTE'
  | 'ASISTIO'
  | 'NO_ASISTIO';

export type ReservationState =
  | 'CONFIRMADA'
  | 'CANCELADA'
  | 'CANCELADA_POR_GIMNASIO';

export type SessionState =
  | 'PROGRAMADA'
  | 'EN_CURSO'
  | 'COMPLETADA'
  | 'CANCELADA';

/**
 * Miembro inscrito en una sesión.
 */
export interface SessionAttendee {
  reservationId: string;
  memberNumber: string;
  memberName: string;
  reservationStatus: ReservationState;
  attendance: AttendanceValue;
}

/**
 * Información de la sesión para su consulta.
 */
export interface AttendanceSession {
  id: string;
  trainerId: string;
  className: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  status: SessionState;
  completedAt: Date | null;
}

/**
 * Lista paginada de inscritos.
 */
export interface SessionAttendeesPage {
  session: AttendanceSession;
  confirmedCount: number;
  data: SessionAttendee[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Información necesaria para comprobar
 * si una reserva admite cambios de asistencia.
 */
export interface AttendanceReservation {
  id: string;
  sessionId: string;
  status: ReservationState;
  attendance: AttendanceValue;
  session: AttendanceSession;
}

/**
 * Resultado de actualizar una asistencia.
 */
export interface AttendanceUpdateResult {
  reservationId: string;
  attendance: 'ASISTIO' | 'NO_ASISTIO';
  updatedAt: Date;
}

/**
 * Resultado de cerrar una sesión.
 */
export interface AttendanceCompletionResult {
  id: string;
  status: 'COMPLETADA';
  completedAt: Date;
  attendedCount: number;
  absentCount: number;
}

/**
 * Contrato que deberá implementar el repositorio
 * cuando se integren los modelos Prisma.
 *
 * Las operaciones de escritura deben validar
 * las condiciones dentro de una transacción.
 */
export interface ClassAttendanceRepositoryContract {
  findSession(
    sessionId: string,
  ): Promise<AttendanceSession | null>;

  findAttendees(
    sessionId: string,
    page: number,
    pageSize: number,
  ): Promise<SessionAttendeesPage>;

  findReservation(
    reservationId: string,
  ): Promise<AttendanceReservation | null>;

  updateAttendance(
    reservationId: string,
    trainerId: string,
    attendance: 'ASISTIO' | 'NO_ASISTIO',
    now: Date,
  ): Promise<AttendanceUpdateResult>;

  completeSession(
    sessionId: string,
    trainerId: string,
    now: Date,
  ): Promise<AttendanceCompletionResult>;
}
