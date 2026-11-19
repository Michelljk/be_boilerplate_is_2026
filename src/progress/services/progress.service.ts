import { Injectable } from '@nestjs/common';
import { DomainError } from '@Common/errors';
import { GymClock } from '@Common/time';
import type { User } from '@PrismaClient';
import { EXERCISE_METRIC } from '../progress-metrics.js';
import { MAX_MARKS_PER_RECORD } from '../limits.js';
import { ProgressRecordRepository } from '../repositories/progress-record.repository.js';
import type {
  EvolutionView,
  ProgressHistoryPage,
  ProgressRecordView,
} from '../progress-views.js';
import type {
  EvolutionQueryDto,
  ProgressHistoryQueryDto,
} from '../dto/progress-query.dto.js';
import type { ProgressRecordInputDto } from '../dto/progress-record-input.dto.js';
import {
  assertMember,
  assertUuid,
  resolveCivilRange,
} from './progress-guards.js';

/**
 * Progreso físico personal (H24) y evolución (H25).
 *
 * El `memberId` nunca se lee del body ni de la query: siempre es el sujeto de la
 * sesión, de modo que un miembro no puede crear ni editar el registro de otro.
 */
@Injectable()
export class ProgressService {
  constructor(
    private readonly repo: ProgressRecordRepository,
    private readonly clock: GymClock,
  ) {}

  /** Alta del registro del día; duplicado responde 409. */
  async create(
    user: User,
    input: ProgressRecordInputDto,
  ): Promise<ProgressRecordView> {
    assertMember(user);
    this.assertInput(input);
    return this.repo.upsert(user.id, input);
  }

  /** Edición del propio registro; ajeno responde 404 sin confirmar su existencia. */
  async update(
    user: User,
    recordId: string,
    input: ProgressRecordInputDto,
  ): Promise<ProgressRecordView> {
    assertMember(user);
    assertUuid(recordId, 'id');
    this.assertInput(input);
    return this.repo.upsert(user.id, input, recordId);
  }

  /** Historial paginado, del más reciente al más antiguo. */
  async history(
    user: User,
    query: ProgressHistoryQueryDto,
  ): Promise<ProgressHistoryPage> {
    assertMember(user);
    return this.repo.history(user.id, query.page, query.pageSize);
  }

  /**
   * Serie de una métrica (H25).
   *
   * `exerciseWeightKg` exige `exerciseId` porque la serie se construye con las
   * marcas de ese ejercicio; los demás indicadores leen su columna del registro.
   */
  async evolution(
    user: User,
    query: EvolutionQueryDto,
  ): Promise<EvolutionView> {
    assertMember(user);
    const range = resolveCivilRange(query.from, query.to);
    if (query.metric === EXERCISE_METRIC && !query.exerciseId) {
      throw new DomainError(
        'INVALID',
        'exerciseId es obligatorio cuando metric es exerciseWeightKg. field=exerciseId',
      );
    }
    return this.repo.evolution(
      user.id,
      query.metric,
      query.exerciseId,
      range.from,
      range.to,
    );
  }

  private assertInput(input: ProgressRecordInputDto): void {
    if (input.recordDate > this.clock.today()) {
      throw new DomainError(
        'INVALID',
        'recordDate no puede ser posterior al día actual. field=recordDate',
      );
    }
    const marks = input.marks;
    if (marks === null) {
      throw new DomainError(
        'INVALID',
        'marks debe ser un arreglo. field=marks',
      );
    }
    if (!marks) {
      return;
    }
    if (marks.length > MAX_MARKS_PER_RECORD) {
      throw new DomainError(
        'INVALID',
        `Un registro admite como máximo ${MAX_MARKS_PER_RECORD} marcas. field=marks`,
      );
    }
    const unique = new Set(marks.map((mark) => mark.exerciseId));
    if (unique.size !== marks.length) {
      throw new DomainError(
        'INVALID',
        'Un mismo ejercicio no puede marcarse dos veces el mismo día. field=marks.exerciseId',
      );
    }
  }
}
