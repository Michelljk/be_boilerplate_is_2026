import { Injectable } from '@nestjs/common';
import { DomainError } from '@Common/errors';
import { GymClock, isCalendarDate } from '@Common/time';
import type { UserRole } from '@PrismaClient';
import {
  type RoutineDetailResponseDto,
  type RoutineHistoryItemResponseDto,
  type RoutineQueriesInput,
  type RoutineQueriesResponseDto,
} from '../dto/routine-queries.dto.js';
import {
  RoutineQueriesRepository,
  type RoutineQueriesSnapshot,
} from '../repositories/routine-queries.repository.js';

export interface RoutineQueryUser {
  id: string;
  role: UserRole;
}

interface NormalizedRoutineQuery {
  includeHistory: boolean;
  page: number;
  pageSize: number;
}

@Injectable()
export class RoutineQueriesService {
  constructor(
    private readonly routineQueriesRepository: RoutineQueriesRepository,
    private readonly gymClock: GymClock,
  ) {}

  async findMine(
    user: RoutineQueryUser,
    query: RoutineQueriesInput,
  ): Promise<RoutineQueriesResponseDto> {
    this.ensureMember(user);
    const normalized = this.normalizeQuery(query);
    const today = this.gymClock.today();
    const snapshot = await this.routineQueriesRepository.findMineSnapshot(
      user.id,
      this.gymClock.dateOnly(today),
      normalized.page,
      normalized.pageSize,
      normalized.includeHistory,
    );
    return this.mapSnapshot(snapshot, normalized);
  }

  async findById(
    user: RoutineQueryUser,
    routineId: string,
  ): Promise<RoutineDetailResponseDto> {
    this.ensureMember(user);
    if (!isUuid(routineId)) {
      throw new DomainError(
        'INVALID',
        'El identificador de rutina debe ser un UUID válido.',
      );
    }
    const routine = await this.routineQueriesRepository.findByIdForMember(
      user.id,
      routineId,
      this.gymClock.dateOnly(this.gymClock.today()),
    );
    if (!routine) throw new DomainError('NOT_FOUND', 'Rutina no encontrada.');
    return this.mapDetail(routine);
  }

  private ensureMember(user: RoutineQueryUser): void {
    if (user.role !== 'MIEMBRO')
      throw new DomainError('FORBIDDEN', 'Acceso denegado.');
  }

  private normalizeQuery(query: RoutineQueriesInput): NormalizedRoutineQuery {
    const includeHistory = query.includeHistory ?? true;
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    if (typeof includeHistory !== 'boolean') {
      throw new DomainError('INVALID', 'includeHistory debe ser true o false.');
    }
    if (!Number.isInteger(page) || page < 1) {
      throw new DomainError(
        'INVALID',
        'page debe ser un entero mayor o igual que 1.',
      );
    }
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) {
      throw new DomainError(
        'INVALID',
        'pageSize debe ser un entero entre 1 y 50.',
      );
    }
    return { includeHistory, page, pageSize };
  }

  private mapSnapshot(
    snapshot: RoutineQueriesSnapshot,
    query: NormalizedRoutineQuery,
  ): RoutineQueriesResponseDto {
    return {
      current: snapshot.current ? this.mapDetail(snapshot.current) : null,
      history: {
        data: snapshot.history.map((routine) => this.mapHistoryItem(routine)),
        total: snapshot.total,
        page: query.page,
        pageSize: query.pageSize,
      },
    };
  }

  private mapDetail(routine: {
    id: string;
    name: string;
    goal: string;
    version: number;
    startsOn: Date;
    endsOn: Date;
    status: string;
    trainer: { profile: { fullName: string } | null };
    exercises: Array<{
      weekday: number;
      sets: number;
      reps: number;
      position: number;
      exercise: { name: string };
    }>;
  }): RoutineDetailResponseDto {
    const trainerName = routine.trainer.profile?.fullName;
    if (!trainerName)
      throw new DomainError(
        'CONFLICT',
        'La rutina no tiene un perfil de entrenador válido.',
      );
    return {
      id: routine.id,
      name: routine.name,
      goal: routine.goal,
      trainerName,
      version: routine.version,
      startsOn: serializeCivilDate(routine.startsOn),
      endsOn: serializeCivilDate(routine.endsOn),
      status: routine.status,
      exercises: routine.exercises.map((exercise) => ({
        exerciseName: exercise.exercise.name,
        weekday: exercise.weekday,
        sets: exercise.sets,
        reps: exercise.reps,
        position: exercise.position,
      })),
    };
  }

  private mapHistoryItem(routine: {
    id: string;
    version: number;
    status: string;
    startsOn: Date;
    endsOn: Date;
  }): RoutineHistoryItemResponseDto {
    return {
      id: routine.id,
      version: routine.version,
      status: routine.status,
      startsOn: serializeCivilDate(routine.startsOn),
      endsOn: serializeCivilDate(routine.endsOn),
    };
  }
}

function serializeCivilDate(value: Date): string {
  const iso = value.toISOString().slice(0, 10);
  if (!isCalendarDate(iso))
    throw new DomainError('CONFLICT', 'La rutina contiene una fecha inválida.');
  return iso;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
