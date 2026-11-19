
import { Injectable } from '@nestjs/common';
import { DomainError } from '@Common/errors';
import { serializable } from '@Common/repositories';
import { PrismaService } from '@Prisma/services';
import type { Prisma } from '@PrismaClient';

import type {
  AttendanceCompletionResult,
  AttendanceReservation,
  AttendanceSession,
  AttendanceUpdateResult,
  ClassAttendanceRepositoryContract,
  SessionAttendee,
  SessionAttendeesPage,
  ReservationState,
  AttendanceValue,
} from './class-attendance.repository.types.js';

type SessionRow = AttendanceSession;

type ReservationRow = {
  id: string;
  sessionId: string;
  status: ReservationState;
  attendance: AttendanceValue;
};

type AttendeeRow = SessionAttendee;

type CountRow = {
  total: number;
};

type AttendanceCountRow = {
  attendedCount: number;
  absentCount: number;
};

@Injectable()
export class ClassAttendanceRepository
  implements ClassAttendanceRepositoryContract
{
  constructor(private readonly prisma: PrismaService) {}

  async findSession(
    sessionId: string,
  ): Promise<AttendanceSession | null> {
    const rows = await this.prisma.$queryRaw<SessionRow[]>`
      SELECT
        cs.id::text AS id,
        cs.trainer_id::text AS "trainerId",
        ct.name AS "className",
        cs.starts_at AS "startsAt",
        cs.ends_at AS "endsAt",
        cs.capacity,
        cs.status::text AS status,
        cs.completed_at AS "completedAt"
      FROM class_sessions cs
      JOIN class_templates ct
        ON ct.id = cs.class_template_id
      WHERE cs.id = ${sessionId}::uuid
    `;

    return rows[0] ?? null;
  }

  async findAttendees(
    sessionId: string,
    page: number,
    pageSize: number,
  ): Promise<SessionAttendeesPage> {
    const session = await this.findSession(sessionId);

    if (!session) {
      throw new DomainError(
        'NOT_FOUND',
        'Sesión grupal no encontrada.',
      );
    }

    const offset = (page - 1) * pageSize;

    const [data, totals] = await Promise.all([
      this.prisma.$queryRaw<AttendeeRow[]>`
        SELECT
          cr.id::text AS "reservationId",
          COALESCE(u.member_number, '') AS "memberNumber",
          u.email AS "memberName",
          cr.status::text AS "reservationStatus",
          cr.attendance::text AS attendance
        FROM class_reservations cr
        JOIN users u ON u.id = cr.member_id
        WHERE cr.session_id = ${sessionId}::uuid
          AND cr.status = 'CONFIRMADA'
        ORDER BY u.email ASC, cr.id ASC
        LIMIT ${pageSize}
        OFFSET ${offset}
      `,
      this.prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(*)::int AS total
        FROM class_reservations
        WHERE session_id = ${sessionId}::uuid
          AND status = 'CONFIRMADA'
      `,
    ]);

    const total = totals[0]?.total ?? 0;

    return {
      session,
      confirmedCount: total,
      data,
      total,
      page,
      pageSize,
    };
  }

  async findReservation(
    reservationId: string,
  ): Promise<AttendanceReservation | null> {
    const rows = await this.prisma.$queryRaw<ReservationRow[]>`
      SELECT
        id::text AS id,
        session_id::text AS "sessionId",
        status::text AS status,
        attendance::text AS attendance
      FROM class_reservations
      WHERE id = ${reservationId}::uuid
    `;

    const reservation = rows[0];

    if (!reservation) {
      return null;
    }

    const session = await this.findSession(
      reservation.sessionId,
    );

    if (!session) {
      return null;
    }

    return {
      ...reservation,
      session,
    };
  }

  async updateAttendance(
    reservationId: string,
    trainerId: string,
    attendance: 'ASISTIO' | 'NO_ASISTIO',
    now: Date,
  ): Promise<AttendanceUpdateResult> {
    return serializable(this.prisma, async (tx) => {
      const references = await tx.$queryRaw<
        { sessionId: string }[]
      >`
        SELECT session_id::text AS "sessionId"
        FROM class_reservations
        WHERE id = ${reservationId}::uuid
      `;

      const reference = references[0];

      if (!reference) {
        throw new DomainError(
          'NOT_FOUND',
          'Reserva no encontrada.',
        );
      }

      // Siempre bloquear primero la sesión y después
      // la reserva para mantener un orden consistente.
      const session = await this.lockSession(
        tx,
        reference.sessionId,
      );

      if (!session || session.trainerId !== trainerId) {
        throw new DomainError(
          'NOT_FOUND',
          'Reserva no encontrada.',
        );
      }

      const rows = await tx.$queryRaw<ReservationRow[]>`
        SELECT
          id::text AS id,
          session_id::text AS "sessionId",
          status::text AS status,
          attendance::text AS attendance
        FROM class_reservations
        WHERE id = ${reservationId}::uuid
        FOR UPDATE
      `;

      const reservation = rows[0];

      if (
        !reservation ||
        reservation.sessionId !== session.id
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

      if (
        session.status !== 'EN_CURSO' ||
        session.startsAt.getTime() > now.getTime()
      ) {
        throw new DomainError(
          'CONFLICT',
          'La sesión no permite registrar asistencia.',
        );
      }

      const updated = await tx.$queryRaw<
        { id: string; attendance: string; updatedAt: Date }[]
      >`
        UPDATE class_reservations
        SET
          attendance = ${attendance}::"AttendanceStatus",
          updated_at = ${now}
        WHERE id = ${reservationId}::uuid
        RETURNING
          id::text AS id,
          attendance::text AS attendance,
          updated_at AS "updatedAt"
      `;

      const result = updated[0];

      if (!result) {
        throw new DomainError(
          'CONFLICT',
          'No se pudo actualizar la asistencia.',
        );
      }

      return {
        reservationId: result.id,
        attendance,
        updatedAt: result.updatedAt,
      };
    });
  }

  async completeSession(
    sessionId: string,
    trainerId: string,
    now: Date,
  ): Promise<AttendanceCompletionResult> {
    return serializable(this.prisma, async (tx) => {
      const session = await this.lockSession(
        tx,
        sessionId,
      );

      if (!session || session.trainerId !== trainerId) {
        throw new DomainError(
          'NOT_FOUND',
          'Sesión grupal no encontrada.',
        );
      }

      if (
        session.status !== 'EN_CURSO' ||
        session.endsAt.getTime() > now.getTime()
      ) {
        throw new DomainError(
          'CONFLICT',
          'La sesión todavía no puede completarse.',
        );
      }

      // Los inscritos confirmados sin asistencia
      // registrada se consideran ausentes.
      await tx.$executeRaw`
        UPDATE class_reservations
        SET
          attendance = 'NO_ASISTIO'::"AttendanceStatus",
          updated_at = ${now}
        WHERE session_id = ${sessionId}::uuid
          AND status = 'CONFIRMADA'
          AND attendance = 'PENDIENTE'
      `;

      const counts = await tx.$queryRaw<
        AttendanceCountRow[]
      >`
        SELECT
          COUNT(*) FILTER (
            WHERE attendance = 'ASISTIO'
          )::int AS "attendedCount",
          COUNT(*) FILTER (
            WHERE attendance = 'NO_ASISTIO'
          )::int AS "absentCount"
        FROM class_reservations
        WHERE session_id = ${sessionId}::uuid
          AND status = 'CONFIRMADA'
      `;

      await tx.$executeRaw`
        UPDATE class_sessions
        SET
          status = 'COMPLETADA'::"SessionStatus",
          completed_at = ${now},
          completed_by_id = ${trainerId}::uuid,
          updated_at = ${now}
        WHERE id = ${sessionId}::uuid
      `;

      return {
        id: sessionId,
        status: 'COMPLETADA',
        completedAt: now,
        attendedCount: counts[0]?.attendedCount ?? 0,
        absentCount: counts[0]?.absentCount ?? 0,
      };
    });
  }

  private async lockSession(
    tx: Prisma.TransactionClient,
    sessionId: string,
  ): Promise<AttendanceSession | null> {
    const rows = await tx.$queryRaw<SessionRow[]>`
      SELECT
        cs.id::text AS id,
        cs.trainer_id::text AS "trainerId",
        ct.name AS "className",
        cs.starts_at AS "startsAt",
        cs.ends_at AS "endsAt",
        cs.capacity,
        cs.status::text AS status,
        cs.completed_at AS "completedAt"
      FROM class_sessions cs
      JOIN class_templates ct
        ON ct.id = cs.class_template_id
      WHERE cs.id = ${sessionId}::uuid
      FOR UPDATE OF cs
    `;

    return rows[0] ?? null;
  }
}
