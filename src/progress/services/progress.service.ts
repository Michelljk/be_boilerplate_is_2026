
import { Injectable } from '@nestjs/common';
import { DomainError } from '@Common/errors';
import { GymClock } from '@Common/time';
import { UserRole } from '@PrismaClient';
import type { User } from '@PrismaClient';

import { MAX_MARKS_PER_RECORD } from '../limits.js';

import { ProgressRecordRepository } from '../repositories/progress-record.repository.js';

import type {
  ProgressHistoryPage,
  ProgressRecordView,
} from '../repositories/progress-record.repository.js';

import type { ProgressRecordInputDto } from '../dto/progress-record-input.dto.js';

/**
 * H24 — Registro y edición de progreso físico.
 */
@Injectable()
export class ProgressService {
  constructor(
    private readonly repo: ProgressRecordRepository,
    private readonly clock: GymClock,
  ) {}

  /**
   * Crea un registro para el miembro autenticado.
   */
  async create(
    user: User,
    input: ProgressRecordInputDto,
  ): Promise<ProgressRecordView> {
    this.assertMember(user);
    this.assertInput(input);

    return this.repo.upsert(user.id, input);
  }

  /**
   * Edita un registro del miembro autenticado.
   */
  async update(
    user: User,
    recordId: string,
    input: ProgressRecordInputDto,
  ): Promise<ProgressRecordView> {
    this.assertMember(user);
    this.assertUuid(recordId);
    this.assertInput(input);

    return this.repo.upsert(
      user.id,
      input,
      recordId,
    );
  }

  /**
   * Devuelve los registros del miembro,
   * ordenados del más reciente al más antiguo.
   */
  async history(
    user: User,
    query: { page: number; pageSize: number },
  ): Promise<ProgressHistoryPage> {
    this.assertMember(user);

    return this.repo.history(
      user.id,
      query.page,
      query.pageSize,
    );
  }

  /**
   * Solo un miembro activo puede gestionar
   * sus propios registros.
   */
  private assertMember(user: User): void {
    if (
      !user?.isActive ||
      user.role !== UserRole.MIEMBRO
    ) {
      throw new DomainError(
        'FORBIDDEN',
        'Acceso denegado.',
      );
    }
  }

  /**
   * Rechaza identificadores inválidos.
   */
  private assertUuid(value: string): void {
    const pattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!pattern.test(value)) {
      throw new DomainError(
        'INVALID',
        'Identificador inválido. field=id',
      );
    }
  }

  /**
   * Comprueba la fecha y las marcas.
   */
  private assertInput(
    input: ProgressRecordInputDto,
  ): void {
    // Impide registrar fechas posteriores a hoy.
    if (input.recordDate > this.clock.today()) {
      throw new DomainError(
        'INVALID',
        'recordDate no puede ser posterior al día actual. field=recordDate',
      );
    }

    const marks = input.marks;

    if (!marks) {
      return;
    }

    // Máximo de marcas permitido.
    if (marks.length > MAX_MARKS_PER_RECORD) {
      throw new DomainError(
        'INVALID',
        `Un registro admite como máximo ${MAX_MARKS_PER_RECORD} marcas. field=marks`,
      );
    }

    // Un ejercicio no puede repetirse.
    const unique = new Set(
      marks.map((mark) => mark.exerciseId),
    );

    if (unique.size !== marks.length) {
      throw new DomainError(
        'INVALID',
        'Un mismo ejercicio no puede marcarse dos veces el mismo día. field=marks.exerciseId',
      );
    }
  }
}
