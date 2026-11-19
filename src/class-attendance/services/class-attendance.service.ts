import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '@Common/errors';
import { UserRole, type User } from '@PrismaClient';

import type {
  AttendanceCompletionResult,
  AttendanceUpdateResult,
  ClassAttendanceRepositoryContract,
  SessionAttendeesPage,
} from '../repositories/class-attendance.repository.types.js';

export const CLASS_ATTENDANCE_REPOSITORY =
  'CLASS_ATTENDANCE_REPOSITORY';

@Injectable()
export class ClassAttendanceService {
  constructor(
    @Inject(CLASS_ATTENDANCE_REPOSITORY)
    private readonly repository: ClassAttendanceRepositoryContract,
  ) {}

  /**
   * H8: consultar los asistentes de una sesión grupal.
   */
  async findAttendees(
    user: User,
    sessionId: string,
    page = 1,
    pageSize = 10,
  ): Promise<SessionAttendeesPage> {
    this.assertTrainer(user);

    const session = await this.repository.findSession(sessionId);

    if (!session || session.trainerId !== user.id) {
      throw new DomainError(
        'NOT_FOUND',
        'Sesión grupal no encontrada.',
      );
    }

    if (
      !Number.isInteger(page) ||
      !Number.isInteger(pageSize) ||
      page < 1 ||
      pageSize < 1
    ) {
      throw new DomainError(
        'BAD_REQUEST',
        'La paginación no es válida.',
      );
    }

    return this.repository.findAttendees(
      sessionId,
      page,
      pageSize,
    );
  }

  /**
   * H8: registrar asistencia o inasistencia.
   */
  async updateAttendance(
    user: User,
    reservationId: string,
    attendance: 'ASISTIO' | 'NO_ASISTIO',
  ): Promise<AttendanceUpdateResult> {
    this.assertTrainer(user);

    if (
      attendance !== 'ASISTIO' &&
      attendance !== 'NO_ASISTIO'
    ) {
      throw new DomainError(
        'BAD_REQUEST',
        'Valor de asistencia no válido.',
      );
    }

    const reservation =
      await this.repository.findReservation(reservationId);

    if (
      !reservation ||
      reservation.session.trainerId !== user.id
    ) {
      throw new DomainError(
        'NOT_FOUND',
        'Reserva no encontrada.',
      );
    }

    if (reservation.status !== 'CONFIRMADA') {
      throw new DomainError(
        'CONFLICT',
        'La reserva no está confirmada.',
      );
    }

    const now = new Date();

    if (
      reservation.session.status !== 'EN_CURSO' ||
      reservation.session.startsAt.getTime() > now.getTime()
    ) {
      throw new DomainError(
        'CONFLICT',
        'La sesión no está habilitada para registrar asistencia.',
      );
    }

    return this.repository.updateAttendance(
      reservationId,
      user.id,
      attendance,
      now,
    );
  }

  /**
   * H8: completar la sesión grupal.
   */
  async completeSession(
    user: User,
    sessionId: string,
  ): Promise<AttendanceCompletionResult> {
    this.assertTrainer(user);

    const session = await this.repository.findSession(sessionId);

    if (!session || session.trainerId !== user.id) {
      throw new DomainError(
        'NOT_FOUND',
        'Sesión grupal no encontrada.',
      );
    }

    const now = new Date();

    if (
      session.status !== 'EN_CURSO' ||
      session.endsAt.getTime() > now.getTime()
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

  private assertTrainer(user: User): void {
    if (user.role !== UserRole.ENTRENADOR) {
      throw new DomainError(
        'FORBIDDEN',
        'Solo un entrenador puede registrar asistencia.',
      );
    }
  }
}
