
import { Injectable } from '@nestjs/common';
import { DomainError } from '@Common/errors';
import { isCalendarDate } from '@Common/time';
import { UserRole } from '@PrismaClient';
import type { User } from '@PrismaClient';

import type {
  EvolutionQueryDto,
} from '../dto/evolution-query.dto.js';

import type {
  EvolutionView,
} from '../dto/evolution-response.dto.js';

import {
  ProgressEvolutionRepository,
} from '../repositories/progress-evolution.repository.js';

const MAX_RANGE_DAYS = 366;
const MILLISECONDS_PER_DAY = 86_400_000;

@Injectable()
export class ProgressEvolutionService {
  constructor(
    private readonly repository: ProgressEvolutionRepository,
  ) {}

  /**
   * H25: consultar la evolución física
   * del miembro autenticado.
   */
  async evolution(
    user: User,
    query: EvolutionQueryDto,
  ): Promise<EvolutionView> {
    this.assertMember(user);
    this.assertRange(query.from, query.to);

    if (
      query.metric === 'exerciseWeightKg' &&
      !query.exerciseId
    ) {
      throw new DomainError(
        'INVALID',
        'exerciseId es obligatorio cuando metric es exerciseWeightKg. field=exerciseId',
      );
    }

    return this.repository.evolution(
      user.id,
      query.metric,
      query.exerciseId,
      query.from ?? null,
      query.to ?? null,
    );
  }

  /**
   * Únicamente miembros activos.
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
   * Validación de fechas civiles.
   */
  private assertRange(
    from?: string,
    to?: string,
  ): void {
    if (from !== undefined && !isCalendarDate(from)) {
      throw new DomainError(
        'INVALID',
        'from debe ser una fecha civil válida en formato YYYY-MM-DD. field=from',
      );
    }

    if (to !== undefined && !isCalendarDate(to)) {
      throw new DomainError(
        'INVALID',
        'to debe ser una fecha civil válida en formato YYYY-MM-DD. field=to',
      );
    }

    if (!from || !to) {
      return;
    }

    if (from > to) {
      throw new DomainError(
        'INVALID',
        'from no puede ser posterior a to. field=from',
      );
    }

    const days =
      (Date.parse(to) - Date.parse(from)) /
        MILLISECONDS_PER_DAY +
      1;

    if (days > MAX_RANGE_DAYS) {
      throw new DomainError(
        'INVALID',
        'El rango máximo admitido es de un año. field=to',
      );
    }
  }
}
