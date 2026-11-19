import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import { serializable } from '@Common/repositories';
import { DomainError } from '@Common/errors';
import { Prisma, AttendanceStatus, PersonalSessionStatus } from '@PrismaClient';

const agendaSelect = {
  id: true,
  startsAt: true,
  endsAt: true,
  status: true,
  attendance: true,
  member: {
    select: {
      profile: { select: { fullName: true } },
      memberProfile: { select: { memberNumber: true } },
    },
  },
} satisfies Prisma.PersonalSessionSelect;

type AgendaSessionRow = Prisma.PersonalSessionGetPayload<{
  select: typeof agendaSelect;
}>;

const attendanceSelect = {
  id: true,
  status: true,
  attendance: true,
  completedAt: true,
} satisfies Prisma.PersonalSessionSelect;

type AttendanceSessionRow = Prisma.PersonalSessionGetPayload<{
  select: typeof attendanceSelect;
}>;

interface LockedAttendanceRow {
  id: string;
  startsAt: Date;
  status: PersonalSessionStatus;
  attendance: AttendanceStatus | null;
}

export interface AgendaSnapshot {
  items: AgendaSessionRow[];
  total: number;
}

@Injectable()
export class TrainerAgendaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAgendaByTrainerAndRange(
    trainerId: string,
    from: Date,
    to: Date,
  ): Promise<AgendaSnapshot> {
    const where: Prisma.PersonalSessionWhereInput = {
      trainerId,
      startsAt: { gte: from, lt: to },
    };

    const [items, total] = await this.prisma.$transaction(
      [
        this.prisma.personalSession.findMany({
          where,
          select: agendaSelect,
          orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
        }),
        this.prisma.personalSession.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );

    return { items, total };
  }

  async completeAttendance(
    id: string,
    trainerId: string,
    attendance: AttendanceStatus,
    now: Date,
  ): Promise<AttendanceSessionRow> {
    return serializable(this.prisma, async (tx) => {
      const locked = await tx.$queryRaw<LockedAttendanceRow[]>`
        SELECT
          id,
          starts_at AS "startsAt",
          status,
          attendance
        FROM personal_sessions
        WHERE id = ${id}::uuid
          AND trainer_id = ${trainerId}::uuid
        FOR UPDATE
      `;

      const current = locked[0];
      if (!current) {
        throw new DomainError('NOT_FOUND', 'Sesión no encontrada.');
      }

      if (
        current.status === PersonalSessionStatus.COMPLETADA ||
        current.attendance === AttendanceStatus.ASISTIO ||
        current.attendance === AttendanceStatus.NO_ASISTIO
      ) {
        throw new DomainError(
          'CONFLICT',
          'La sesión ya tiene asistencia registrada',
        );
      }

      if (current.status === PersonalSessionStatus.CANCELADA) {
        throw new DomainError(
          'CONFLICT',
          'No puedes registrar asistencia de una sesión cancelada.',
        );
      }

      if (
        current.status !== PersonalSessionStatus.CONFIRMADA ||
        now.getTime() <= current.startsAt.getTime()
      ) {
        throw new DomainError(
          'CONFLICT',
          'Solo puedes registrar asistencia después de la hora de inicio',
        );
      }

      const updated = await tx.personalSession.updateMany({
        where: {
          id,
          trainerId,
          status: PersonalSessionStatus.CONFIRMADA,
          startsAt: { lt: now },
          OR: [
            { attendance: null },
            { attendance: AttendanceStatus.PENDIENTE },
          ],
        },
        data: {
          attendance,
          status: PersonalSessionStatus.COMPLETADA,
          completedAt: now,
          markedById: trainerId,
          updatedAt: now,
        },
      });

      if (updated.count !== 1) {
        throw new DomainError(
          'CONFLICT',
          'La sesión ya tiene asistencia registrada',
        );
      }

      const result = await tx.personalSession.findUnique({
        where: { id },
        select: attendanceSelect,
      });
      if (!result) {
        throw new DomainError('NOT_FOUND', 'Sesión no encontrada.');
      }
      return result;
    });
  }
}
