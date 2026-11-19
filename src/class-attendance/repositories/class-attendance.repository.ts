import { Injectable } from '@nestjs/common';
import {
  AttendanceStatus,
  Prisma,
  ReservationStatus,
  SessionStatus,
} from '@PrismaClient';
import { DomainError } from '@Common/errors';
import { PrismaService } from '@Prisma/services';

export interface AttendeeListResult {
  sessionId: string;
  className: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  confirmedCount: number;
  data: Array<{
    reservationId: string;
    memberNumber: string;
    memberName: string;
    reservationStatus: ReservationStatus;
    attendance: AttendanceStatus;
  }>;
  total: number;
  page: number;
  pageSize: number;
}

export interface AttendanceUpdateResult {
  reservationId: string;
  attendance:
    typeof AttendanceStatus.ASISTIO | typeof AttendanceStatus.NO_ASISTIO;
  updatedAt: Date;
}

export interface CompleteSessionResult {
  id: string;
  status: typeof SessionStatus.COMPLETADA;
  completedAt: Date;
  attendedCount: number;
  absentCount: number;
}

@Injectable()
export class ClassAttendanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async attendees(
    sessionId: string,
    trainerId: string,
    page: number,
    pageSize: number,
    _now: Date,
  ): Promise<AttendeeListResult> {
    return this.prisma.$transaction(
      async (tx) => {
        await this.lockSession(tx, sessionId);
        const session = await tx.classSession.findUnique({
          where: { id: sessionId },
          select: {
            id: true,
            trainerId: true,
            startsAt: true,
            endsAt: true,
            capacity: true,
            status: true,
            classTemplate: { select: { name: true } },
          },
        });
        this.assertOwned(session, trainerId);

        const where = {
          sessionId,
          status: ReservationStatus.CONFIRMADA,
        } as const;
        const [confirmedCount, rows] = await Promise.all([
          tx.classReservation.count({ where }),
          tx.classReservation.findMany({
            where,
            select: {
              id: true,
              status: true,
              attendance: true,
              member: {
                select: {
                  profile: { select: { fullName: true } },
                  memberProfile: { select: { memberNumber: true } },
                },
              },
            },
            orderBy: [
              { member: { profile: { fullName: 'asc' } } },
              { id: 'asc' },
            ],
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
        ]);
        return {
          sessionId: session.id,
          className: session.classTemplate.name,
          startsAt: session.startsAt,
          endsAt: session.endsAt,
          capacity: session.capacity,
          confirmedCount,
          data: rows.map((row) => ({
            reservationId: row.id,
            memberNumber: row.member.memberProfile?.memberNumber ?? '',
            memberName: row.member.profile?.fullName ?? 'Nombre no disponible',
            reservationStatus: row.status,
            attendance: row.attendance,
          })),
          total: confirmedCount,
          page,
          pageSize,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async updateAttendance(
    reservationId: string,
    trainerId: string,
    attendance:
      typeof AttendanceStatus.ASISTIO | typeof AttendanceStatus.NO_ASISTIO,
    now: Date,
  ): Promise<AttendanceUpdateResult> {
    return this.prisma.$transaction(
      async (tx) => {
        const lookup = await tx.classReservation.findUnique({
          where: { id: reservationId },
          select: { sessionId: true },
        });
        if (!lookup)
          throw new DomainError('NOT_FOUND', 'La reserva no existe.');
        await this.lockSession(tx, lookup.sessionId);
        await tx.$queryRaw`SELECT id FROM class_reservations WHERE id = ${reservationId}::uuid FOR UPDATE`;

        let session = await tx.classSession.findUnique({
          where: { id: lookup.sessionId },
          select: {
            id: true,
            trainerId: true,
            startsAt: true,
            endsAt: true,
            status: true,
          },
        });
        this.assertOwned(session, trainerId);
        session = await this.markStartedIfDue(tx, session, now);
        if (
          session.status !== SessionStatus.EN_CURSO ||
          now < session.startsAt
        ) {
          throw new DomainError(
            'CONFLICT',
            'No se puede registrar asistencia en esta sesión.',
          );
        }

        const reservation = await tx.classReservation.findUnique({
          where: { id: reservationId },
          select: { id: true, status: true },
        });
        if (
          !reservation ||
          reservation.status !== ReservationStatus.CONFIRMADA
        ) {
          throw new DomainError('CONFLICT', 'La reserva no está confirmada.');
        }
        const updated = await tx.classReservation.update({
          where: { id: reservationId },
          data: {
            attendance,
            attendanceUpdatedAt: now,
            attendanceUpdatedById: trainerId,
          },
          select: { id: true, attendance: true, attendanceUpdatedAt: true },
        });
        if (
          updated.attendance !== AttendanceStatus.ASISTIO &&
          updated.attendance !== AttendanceStatus.NO_ASISTIO
        ) {
          throw new DomainError(
            'CONFLICT',
            'La asistencia no quedó registrada.',
          );
        }
        return {
          reservationId: updated.id,
          attendance: updated.attendance,
          updatedAt: updated.attendanceUpdatedAt ?? now,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async complete(
    sessionId: string,
    trainerId: string,
    now: Date,
  ): Promise<CompleteSessionResult> {
    return this.prisma.$transaction(
      async (tx) => {
        await this.lockSession(tx, sessionId);
        let session = await tx.classSession.findUnique({
          where: { id: sessionId },
          select: {
            id: true,
            trainerId: true,
            startsAt: true,
            endsAt: true,
            status: true,
            completedAt: true,
          },
        });
        this.assertOwned(session, trainerId);
        if (session.status === SessionStatus.COMPLETADA) {
          return this.completedSummary(tx, sessionId, session, now);
        }
        session = await this.markStartedIfDue(tx, session, now);
        if (session.status !== SessionStatus.EN_CURSO || now < session.endsAt) {
          throw new DomainError(
            'CONFLICT',
            'La sesión solo puede cerrarse al finalizar su horario.',
          );
        }

        await tx.classReservation.updateMany({
          where: {
            sessionId,
            status: ReservationStatus.CONFIRMADA,
            attendance: AttendanceStatus.PENDIENTE,
          },
          data: {
            attendance: AttendanceStatus.NO_ASISTIO,
            attendanceUpdatedAt: now,
            attendanceUpdatedById: trainerId,
          },
        });
        const completed = await tx.classSession.update({
          where: { id: sessionId },
          data: {
            status: SessionStatus.COMPLETADA,
            completedAt: now,
            completedById: trainerId,
          },
          select: { id: true, status: true, completedAt: true },
        });
        const [attendedCount, absentCount] = await Promise.all([
          tx.classReservation.count({
            where: {
              sessionId,
              status: ReservationStatus.CONFIRMADA,
              attendance: AttendanceStatus.ASISTIO,
            },
          }),
          tx.classReservation.count({
            where: {
              sessionId,
              status: ReservationStatus.CONFIRMADA,
              attendance: AttendanceStatus.NO_ASISTIO,
            },
          }),
        ]);
        return {
          id: completed.id,
          status: SessionStatus.COMPLETADA,
          completedAt: completed.completedAt ?? now,
          attendedCount,
          absentCount,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /** H8 criterio 5 del PDF: EN_CURSO se activa al inicio; el GET nunca escribe. */
  async advanceDueSessions(now: Date): Promise<number> {
    const result = await this.prisma.classSession.updateMany({
      where: { status: SessionStatus.PROGRAMADA, startsAt: { lte: now } },
      data: { status: SessionStatus.EN_CURSO },
    });
    return result.count;
  }
  private async completedSummary(
    tx: Prisma.TransactionClient,
    sessionId: string,
    session: { id: string; completedAt: Date | null },
    now: Date,
  ): Promise<CompleteSessionResult> {
    const [attendedCount, absentCount] = await Promise.all([
      tx.classReservation.count({
        where: {
          sessionId,
          status: ReservationStatus.CONFIRMADA,
          attendance: AttendanceStatus.ASISTIO,
        },
      }),
      tx.classReservation.count({
        where: {
          sessionId,
          status: ReservationStatus.CONFIRMADA,
          attendance: AttendanceStatus.NO_ASISTIO,
        },
      }),
    ]);
    return {
      id: session.id,
      status: SessionStatus.COMPLETADA,
      completedAt: session.completedAt ?? now,
      attendedCount,
      absentCount,
    };
  }
  private assertOwned<T extends { trainerId: string }>(
    session: T | null,
    trainerId: string,
  ): asserts session is T {
    if (!session || session.trainerId !== trainerId) {
      throw new DomainError('NOT_FOUND', 'La sesión no existe.');
    }
  }

  private async markStartedIfDue<
    T extends { id: string; startsAt: Date; status: SessionStatus },
  >(tx: Prisma.TransactionClient, session: T, now: Date): Promise<T> {
    if (session.status !== SessionStatus.PROGRAMADA || now < session.startsAt)
      return session;
    await tx.classSession.update({
      where: { id: session.id },
      data: { status: SessionStatus.EN_CURSO },
    });
    return { ...session, status: SessionStatus.EN_CURSO };
  }

  private async lockSession(
    tx: Prisma.TransactionClient,
    sessionId: string,
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM class_sessions WHERE id = ${sessionId}::uuid FOR UPDATE`;
    if (rows.length === 0)
      throw new DomainError('NOT_FOUND', 'La sesión no existe.');
  }
}
