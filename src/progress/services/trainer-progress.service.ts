import { Injectable } from '@nestjs/common';
import type { User } from '@PrismaClient';
import { ProgressTrainerRepository } from '../repositories/progress-trainer.repository.js';
import type {
  CivilRange,
  MemberProgressView,
  TrainerMemberPage,
} from '../progress-views.js';
import type {
  MemberProgressQueryDto,
  TrainerMemberQueryDto,
} from '../dto/progress-query.dto.js';
import {
  assertCivilRange,
  assertTrainer,
  assertUuid,
} from './progress-guards.js';

/** Superficie de lectura del entrenador sobre sus clientes asignados (H26). */
@Injectable()
export class TrainerProgressService {
  constructor(private readonly repo: ProgressTrainerRepository) {}

  /** Directorio paginado con búsqueda por nombre o número de miembro. */
  async members(
    user: User,
    query: TrainerMemberQueryDto,
  ): Promise<TrainerMemberPage> {
    assertTrainer(user);
    return this.repo.members(
      user.id,
      (query.search ?? '').trim(),
      query.page,
      query.pageSize,
    );
  }

  /**
   * Ficha del cliente.
   *
   * El rango se valida igual que en H25 y la asignación se comprueba en el
   * repositorio: si no es del entrenador o está finalizada, 404.
   */
  async memberProgress(
    user: User,
    memberId: string,
    query: MemberProgressQueryDto,
  ): Promise<MemberProgressView> {
    assertTrainer(user);
    assertUuid(memberId, 'memberId');
    assertCivilRange(query.from, query.to);
    const filter: CivilRange = {
      from: query.from ?? null,
      to: query.to ?? null,
    };
    return this.repo.memberProgress(user.id, memberId, filter);
  }
}
