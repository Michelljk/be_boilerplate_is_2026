
import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '@Common/errors';

import type {
  AttendanceCompletionResult,
  AttendanceUpdateResult,
  ClassAttendanceRepositoryContract,
  SessionAttendeesPage,
  AttendanceSession,
} from '../repositories/class-attendance.repository.types.js';

import type { AttendeesQueryDto } from '../dto/attendees-query.dto.js';
import type { UpdateAttendanceDto } from '../dto/update-attendance.dto.js';

export const CLASS_ATTENDANCE_REPOSITORY =
  'CLASS_ATTENDANCE_REPOSITORY';

interface AuthenticatedTrainer {
  id: string;
  role: string;
  isActive: boolean;
}

/**
 * H8 — Consulta y registro de asistencia
 * en sesiones grupales.
 */
@Injectable()
export class ClassAttendanceService {
  constructor(
    @Inject(CLASS_ATTENDANCE_REPOSITORY)
    private readonly repository:
      ClassAttendanceRepositoryContract,
  ) {}

  /**
   * Verifica que el usuario sea un entrenador activo.
   */
  private assertTrainer(
    user: AuthenticatedTrainer,
  ): void {
    if (
      !user?.isActive ||
      user.role !== 'ENTRENADOR'
    ) {
      throw new DomainError(
        'FORBIDDEN',
        'Acceso denegado.',
      );
    }
  }

  /**
   * Verifica que la sesión pertenezca
   * al entrenador autenticado.
   */
  private assertOwnership(
    session: AttendanceSession | null,
    trainerId: string,
  ): asserts session is AttendanceSession {
    if (!session || session.trainerId !== trainerId) {
      throw new DomainError(
        'NOT_FOUND',
        'Recurso no encontrado.',
      );
    }
  }

  /**
   * H8 — Consultar los inscritos de una sesión.
   */
  async attendees(
    user: AuthenticatedTrainer,
    sessionId: string,
    query: AttendeesQueryDto,
  ): Promise<SessionAttendeesPage> {
    this.assertTrainer(user);

    const session =
      await this.repository.findSession(sessionId);

    this.assertOwnership(session, user.id);

    return this.repository.findAttendees(
      sessionId,
      query.page,
      query.pageSize,
    );
  }

  /**
   * H8 — Marcar asistencia.
   */
  async updateAttendance(
    user: AuthenticatedTrainer,
    reservationId: string,
    dto: UpdateAttendanceDto,
  ): Promise<AttendanceUpdateResult> {
    this.assertTrainer(user);

    const reservation =
      await this.repository.findReservation(
        reservationId,
      );

    if (!reservation) {
      throw new DomainError(
        'NOT_FOUND',
        'Recurso no encontrado.',
      );
    }

    const session = reservation.session;

    this.assertOwnership(session, user.id);

    if (
      dto.attendance !== 'ASISTIO' &&
      dto.attendance !== 'NO_ASISTIO'
    ) {
      throw new DomainError(
        'INVALID',
        'attendance debe ser ASISTIO o NO_ASISTIO.',
      );
    }

    const now = new Date();

    if (
      reservation.status !== 'CONFIRMADA' ||
      session.status !== 'EN_CURSO' ||
      now < session.startsAt ||
      now > session.endsAt
    ) {
      throw new DomainError(
        'CONFLICT',
        'No se puede registrar asistencia en esta sesión.',
      );
    }

    return this.repository.updateAttendance(
      reservationId,
      user.id,
      dto.attendance,
      now,
    );
  }

  /**
   * H8 — Cerrar la lista de asistencia.
   */
  async completeSession(
    user: AuthenticatedTrainer,
    sessionId: string,
  ): Promise<AttendanceCompletionResult> {
    this.assertTrainer(user);

    const session =
      await this.repository.findSession(sessionId);

    this.assertOwnership(session, user.id);

    const now = new Date();

    if (
      session.status !== 'EN_CURSO' ||
      now < session.endsAt
    ) {
      throw new DomainError(
        'CONFLICT',
        'La sesión todavía no puede completarse.',
      );
    }

    return this.repository.completeSession(
      sessionId,
      user.id,
      now,
    );
  }
}
