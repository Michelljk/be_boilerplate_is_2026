import { Injectable } from '@nestjs/common';
import { Prisma, type RoutineStatus } from '@PrismaClient';
import { PrismaService } from '@Prisma/services';
import { DomainError } from '@Common/errors';
import { serializable } from '@Common/repositories';
import { isCalendarDate } from '@Common/time';

const routineDetailSelect = {
  id: true,
  name: true,
  goal: true,
  version: true,
  startsOn: true,
  endsOn: true,
  status: true,
  trainer: {
    select: {
      profile: {
        select: { fullName: true },
      },
    },
  },
  exercises: {
    orderBy: [{ weekday: 'asc' }, { position: 'asc' }],
    select: {
      weekday: true,
      sets: true,
      reps: true,
      position: true,
      exercise: { select: { name: true } },
    },
  },
} satisfies Prisma.TrainingRoutineSelect;

type RoutineDetailRecord = Prisma.TrainingRoutineGetPayload<{
  select: typeof routineDetailSelect;
}>;

type RoutineHistoryRecord = {
  id: string;
  version: number;
  status: RoutineStatus;
  startsOn: Date;
  endsOn: Date;
};

export interface RoutineQueriesSnapshot {
  current: RoutineDetailRecord | null;
  history: RoutineHistoryRecord[];
  total: number;
}

@Injectable()
export class RoutineQueriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMineSnapshot(
    memberId: string,
    today: Date,
    page: number,
    pageSize: number,
    includeHistory: boolean,
  ): Promise<RoutineQueriesSnapshot> {
    return serializable(this.prisma, async (tx) => {
      await this.finalizeExpiredLocked(tx, memberId, today);

      const currentCandidates = await tx.trainingRoutine.findMany({
        where: {
          memberId,
          status: 'VIGENTE',
          startsOn: { lte: today },
          endsOn: { gte: today },
        },
        orderBy: { version: 'desc' },
        take: 2,
        select: routineDetailSelect,
      });
      if (currentCandidates.length > 1) {
        throw new DomainError(
          'CONFLICT',
          'La información de rutinas vigentes es inconsistente.',
        );
      }

      const current = currentCandidates[0] ?? null;
      if (!includeHistory) return { current, history: [], total: 0 };

      const historyWhere = {
        memberId,
        ...(current ? { id: { not: current.id } } : {}),
      };
      const [history, total] = await Promise.all([
        tx.trainingRoutine.findMany({
          where: historyWhere,
          orderBy: { version: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            version: true,
            status: true,
            startsOn: true,
            endsOn: true,
          },
        }),
        tx.trainingRoutine.count({ where: historyWhere }),
      ]);
      return { current, history, total };
    });
  }

  async findByIdForMember(
    memberId: string,
    routineId: string,
    today: Date,
  ): Promise<RoutineDetailRecord | null> {
    return serializable(this.prisma, async (tx) => {
      await this.finalizeExpiredLocked(tx, memberId, today);
      return tx.trainingRoutine.findFirst({
        where: { id: routineId, memberId },
        select: routineDetailSelect,
      });
    });
  }

  private async finalizeExpiredLocked(
    tx: Prisma.TransactionClient,
    memberId: string,
    today: Date,
  ): Promise<void> {
    const civilToday = today.toISOString().slice(0, 10);
    if (!isCalendarDate(civilToday))
      throw new DomainError('INVALID', 'La fecha del gimnasio no es válida.');
    await tx.$queryRaw<{ id: string }[]>`
      SELECT id
      FROM training_routines
      WHERE member_id = ${memberId}::uuid
        AND status = 'VIGENTE'
        AND ends_on < ${civilToday}::date
      FOR UPDATE
    `;
    await tx.trainingRoutine.updateMany({
      where: { memberId, status: 'VIGENTE', endsOn: { lt: today } },
      data: { status: 'FINALIZADA' },
    });
  }
}
