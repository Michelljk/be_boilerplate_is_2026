import { Injectable } from '@nestjs/common';
import { eligibleMembership } from '../../memberships/repositories/eligible-membership.js';
import { DomainError } from '@Common/errors';
import { serializable } from '@Common/repositories';
import { PrismaService } from '@Prisma/services';
import {
  AssignmentStatus,
  Prisma,
  RoutineStatus,
  UserRole,
} from '@PrismaClient';
import type { CreateRoutineExerciseDto } from '../dto/create-training-routine.dto.js';
import type { TrainingRoutineAssignment } from '../services/routine-assignment.service.js';

export interface CreateRoutineAssignmentData {
  memberId: string;
  name: string;
  goal: string;
  startsOn: Date;
  endsOn: Date;
  assignedAt: Date;
  exercises: CreateRoutineExerciseDto[];
}

/** Único punto H22 que accede a Prisma y encapsula la transacción. */
@Injectable()
export class RoutineAssignmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async assignRoutine(
    trainerId: string,
    today: string,
    data: CreateRoutineAssignmentData,
  ): Promise<TrainingRoutineAssignment> {
    const observedVersion = await this.latestVersion(data.memberId);

    return serializable(this.prisma, async (tx) => {
      await this.lockMember(tx, data.memberId);

      const member = await tx.user.findUnique({
        where: { id: data.memberId },
        select: {
          id: true,
          role: true,
          memberProfile: { select: { id: true } },
        },
      });
      if (!member) throw new DomainError('NOT_FOUND', 'Recurso no encontrado.');
      if (member.role !== UserRole.MIEMBRO || !member.memberProfile) {
        throw new DomainError(
          'CONFLICT',
          'Los datos del miembro no están completos.',
        );
      }

      const currentVersion = await this.latestVersionInTransaction(
        tx,
        data.memberId,
      );
      if (currentVersion !== observedVersion) {
        throw new DomainError(
          'CONFLICT',
          'La rutina del miembro cambió mientras se procesaba la asignación.',
        );
      }

      const assignment = await tx.trainerMemberAssignment.findFirst({
        where: {
          trainerId,
          memberId: data.memberId,
          status: AssignmentStatus.ACTIVA,
        },
        select: { id: true },
      });
      if (!assignment) {
        throw new DomainError('NOT_FOUND', 'Recurso no encontrado.');
      }

      await eligibleMembership(tx, data.memberId, today);

      const exerciseIds = [
        ...new Set(data.exercises.map((exercise) => exercise.exerciseId)),
      ];
      const catalogExercises = await tx.exercise.findMany({
        where: { id: { in: exerciseIds }, isActive: true },
        select: { id: true },
      });
      if (catalogExercises.length !== exerciseIds.length) {
        throw new DomainError(
          'INVALID',
          'Uno o más ejercicios no pertenecen al catálogo activo. field=exercises.exerciseId',
        );
      }

      const current = await tx.trainingRoutine.findFirst({
        where: { memberId: data.memberId, status: RoutineStatus.VIGENTE },
        orderBy: [{ version: 'desc' }, { id: 'asc' }],
        select: { id: true },
      });
      if (current) {
        const changed = await tx.trainingRoutine.updateMany({
          where: { id: current.id, status: RoutineStatus.VIGENTE },
          data: { status: RoutineStatus.REEMPLAZADA },
        });
        if (changed.count !== 1) {
          throw new DomainError(
            'CONFLICT',
            'La rutina vigente cambió mientras se procesaba la asignación.',
          );
        }
      }

      const routine = await tx.trainingRoutine.create({
        data: {
          memberId: data.memberId,
          trainerId,
          name: data.name,
          goal: data.goal,
          version: currentVersion + 1,
          startsOn: data.startsOn,
          endsOn: data.endsOn,
          assignedAt: data.assignedAt,
          status: RoutineStatus.VIGENTE,
        },
        select: {
          id: true,
          memberId: true,
          trainerId: true,
          version: true,
          status: true,
          assignedAt: true,
          startsOn: true,
          endsOn: true,
        },
      });

      await tx.routineExercise.createMany({
        data: data.exercises.map((exercise) => ({
          routineId: routine.id,
          exerciseId: exercise.exerciseId,
          weekday: exercise.weekday,
          sets: exercise.sets,
          reps: exercise.reps,
          position: exercise.position,
        })),
      });

      return {
        ...routine,
        status: RoutineStatus.VIGENTE,
        exerciseCount: data.exercises.length,
      };
    });
  }

  private async latestVersion(memberId: string): Promise<number> {
    const latest = await this.prisma.trainingRoutine.findFirst({
      where: { memberId },
      orderBy: [{ version: 'desc' }, { id: 'asc' }],
      select: { version: true },
    });
    return latest?.version ?? 0;
  }

  private async latestVersionInTransaction(
    tx: Prisma.TransactionClient,
    memberId: string,
  ): Promise<number> {
    const latest = await tx.trainingRoutine.findFirst({
      where: { memberId },
      orderBy: [{ version: 'desc' }, { id: 'asc' }],
      select: { version: true },
    });
    return latest?.version ?? 0;
  }

  private async lockMember(
    tx: Prisma.TransactionClient,
    memberId: string,
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM "users"
      WHERE id = ${memberId}::uuid
      FOR UPDATE
    `;
    if (rows.length === 0)
      throw new DomainError('NOT_FOUND', 'Recurso no encontrado.');
  }
}
