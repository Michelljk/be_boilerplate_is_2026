import { Injectable } from '@nestjs/common';
import { DomainError } from '@Common/errors';
import { GymClock, isCalendarDate } from '@Common/time';
import type { User } from '@PrismaClient';
import type {
  CreateTrainingRoutineDto,
  CreateRoutineExerciseDto,
} from '../dto/create-training-routine.dto.js';
import {
  RoutineAssignmentRepository,
  type CreateRoutineAssignmentData,
} from '../repositories/routine-assignment.repository.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROUTINE_FIELDS = new Set([
  'memberId',
  'name',
  'goal',
  'startsOn',
  'endsOn',
  'exercises',
]);
const EXERCISE_FIELDS = new Set([
  'exerciseId',
  'weekday',
  'sets',
  'reps',
  'position',
]);

export interface TrainingRoutineAssignment {
  id: string;
  memberId: string;
  trainerId: string;
  version: number;
  status: 'VIGENTE';
  assignedAt: Date;
  startsOn: Date;
  endsOn: Date;
  exerciseCount: number;
}

/** Orquesta H22 sin conocer Prisma; toda persistencia queda en el repositorio. */
@Injectable()
export class RoutineAssignmentService {
  constructor(
    private readonly routineAssignmentRepository: RoutineAssignmentRepository,
    private readonly gymClock: GymClock,
  ) {}

  async assign(
    user: User,
    dto: CreateTrainingRoutineDto,
  ): Promise<TrainingRoutineAssignment> {
    if (!user.isActive || user.role !== 'ENTRENADOR') {
      throw new DomainError('FORBIDDEN', 'Acceso denegado.');
    }

    const normalized = this.validateAndNormalize(dto);
    const data: CreateRoutineAssignmentData = {
      ...normalized,
      assignedAt: this.gymClock.now(),
      startsOn: this.gymClock.dateOnly(normalized.startsOn),
      endsOn: this.gymClock.dateOnly(normalized.endsOn),
    };

    return this.routineAssignmentRepository.assignRoutine(
      user.id,
      this.gymClock.today(),
      data,
    );
  }

  private validateAndNormalize(dto: CreateTrainingRoutineDto): Omit<
    CreateRoutineAssignmentData,
    'assignedAt' | 'startsOn' | 'endsOn'
  > & {
    startsOn: string;
    endsOn: string;
  } {
    if (!dto || typeof dto !== 'object') this.invalid('body');
    this.rejectExtraProperties(
      dto as unknown as Record<string, unknown>,
      ROUTINE_FIELDS,
      'body',
    );

    if (!this.isUuid(dto.memberId)) this.invalid('memberId');
    if (
      typeof dto.name !== 'string' ||
      dto.name.trim().length < 3 ||
      dto.name.trim().length > 80
    )
      this.invalid('name');
    if (
      typeof dto.goal !== 'string' ||
      dto.goal.trim().length < 3 ||
      dto.goal.trim().length > 250
    )
      this.invalid('goal');
    if (!isCalendarDate(dto.startsOn)) this.invalid('startsOn');
    if (!isCalendarDate(dto.endsOn)) this.invalid('endsOn');
    if (dto.startsOn > dto.endsOn) this.invalid('endsOn');
    if (
      !Array.isArray(dto.exercises) ||
      dto.exercises.length < 1 ||
      dto.exercises.length > 50
    )
      this.invalid('exercises');

    const seen = new Set<string>();
    const exercises = dto.exercises.map((exercise, index) => {
      if (!exercise || typeof exercise !== 'object')
        this.invalid(`exercises[${index}]`);
      const row = exercise as unknown as Record<string, unknown>;
      this.rejectExtraProperties(row, EXERCISE_FIELDS, `exercises[${index}]`);
      if (!this.isUuid(row.exerciseId))
        this.invalid(`exercises[${index}].exerciseId`);
      if (!this.isIntegerInRange(row.weekday, 1, 7))
        this.invalid(`exercises[${index}].weekday`);
      if (!this.isIntegerInRange(row.sets, 1, 10))
        this.invalid(`exercises[${index}].sets`);
      if (!this.isIntegerInRange(row.reps, 1, 100))
        this.invalid(`exercises[${index}].reps`);
      if (!this.isIntegerInRange(row.position, 1, 50))
        this.invalid(`exercises[${index}].position`);
      const key = `${row.weekday}:${row.position}`;
      if (seen.has(key)) this.invalid(`exercises[${index}].position`);
      seen.add(key);
      return {
        exerciseId: row.exerciseId as string,
        weekday: row.weekday as number,
        sets: row.sets as number,
        reps: row.reps as number,
        position: row.position as number,
      } satisfies CreateRoutineExerciseDto;
    });

    return {
      memberId: dto.memberId,
      name: dto.name.trim(),
      goal: dto.goal.trim(),
      startsOn: dto.startsOn,
      endsOn: dto.endsOn,
      exercises,
    };
  }

  private rejectExtraProperties(
    value: Record<string, unknown>,
    allowed: Set<string>,
    field: string,
  ): void {
    const extra = Object.keys(value).find((key) => !allowed.has(key));
    if (extra) this.invalid(`${field}.${extra}`);
  }

  private isUuid(value: unknown): value is string {
    return typeof value === 'string' && UUID_PATTERN.test(value);
  }

  private isIntegerInRange(
    value: unknown,
    min: number,
    max: number,
  ): value is number {
    return (
      typeof value === 'number' &&
      Number.isSafeInteger(value) &&
      value >= min &&
      value <= max
    );
  }

  private invalid(field: string): never {
    throw new DomainError(
      'INVALID',
      `Solicitud inválida; revisa el campo ${field}. field=${field}`,
    );
  }
}
