
import { Injectable } from '@nestjs/common';
import { DomainError } from '@Common/errors';
import { UserRole } from '@PrismaClient';
import type { User } from '@PrismaClient';

import { ProgressTrainerRepository } from '../repositories/progress-trainer.repository.js';

import type { TrainerMemberQueryDto } from '../dto/trainer-member-query.dto.js';

import type {
  MemberProgressView,
  TrainerMemberPage,
} from '../dto/trainer-progress-response.dto.js';

/**
 * H26 — Consulta de miembros asignados
 * y de su progreso físico.
 */
@Injectable()
export class TrainerProgressService {
  constructor(
    private readonly repository: ProgressTrainerRepository,
  ) {}

  /**
   * Consulta los miembros asignados
   * al entrenador autenticado.
   */
  async members(
    user: User,
    query: TrainerMemberQueryDto,
  ): Promise<TrainerMemberPage> {
    this.assertTrainer(user);

    return this.repository.members(
      user.id,
      (query.search ?? '').trim(),
      query.page,
      query.pageSize,
    );
  }

  /**
   * Consulta el progreso físico de un miembro
   * con asignación activa.
   */
  async memberProgress(
    user: User,
    memberId: string,
  ): Promise<MemberProgressView> {
    this.assertTrainer(user);
    this.assertUuid(memberId);

    return this.repository.memberProgress(
      user.id,
      memberId,
    );
  }

  /**
   * Solo entrenadores activos pueden acceder.
   */
  private assertTrainer(user: User): void {
    if (
      !user?.isActive ||
      user.role !== UserRole.ENTRENADOR
    ) {
      throw new DomainError(
        'FORBIDDEN',
        'Acceso denegado.',
      );
    }
  }

  /**
   * Valida el identificador del miembro.
   */
  private assertUuid(value: string): void {
    const pattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!pattern.test(value)) {
      throw new DomainError(
        'INVALID',
        'Identificador inválido. field=memberId',
      );
    }
  }
}
