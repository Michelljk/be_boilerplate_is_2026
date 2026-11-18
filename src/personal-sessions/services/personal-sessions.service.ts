import { Injectable } from '@nestjs/common';
import { DomainError } from '@Common/errors';
import { GymClock } from '@Common/time';
import { UserRole, type User } from '@PrismaClient';
import { bookingWindowEnd, cancellationDeadline } from '../domain/index.js';
import { PersonalSessionsRepository } from '../repositories/index.js';
import type {
  BookedSessionRecord,
  CancelledSessionRecord,
  PersonalSessionPageRecord,
  TrainerSlotOption,
} from '../repositories/index.js';
import type {
  CreatePersonalSessionDto,
  ListPersonalSessionsQueryDto,
} from '../dto/index.js';

/** Casos de uso de H10 (agendar) y H11 (cancelar) para el miembro autenticado. */
@Injectable()
export class PersonalSessionsService {
  constructor(
    private readonly repository: PersonalSessionsRepository,
    private readonly clock: GymClock,
  ) {}

  async freeSlots(user: User, trainerId: string): Promise<TrainerSlotOption[]> {
    this.assertMember(user);
    const now = this.clock.now();
    return this.repository.findFreeSlots({
      trainerId,
      from: now,
      until: bookingWindowEnd(now),
    });
  }

  async create(
    user: User,
    dto: CreatePersonalSessionDto,
  ): Promise<BookedSessionRecord> {
    this.assertMember(user);
    const now = this.clock.now();
    return this.repository.book({
      memberId: user.id,
      slotId: dto.slotId,
      now,
      windowEnd: bookingWindowEnd(now),
      today: this.clock.dateOf(now),
    });
  }

  async mine(
    user: User,
    query: ListPersonalSessionsQueryDto,
  ): Promise<PersonalSessionPageRecord> {
    this.assertMember(user);
    const pageSize = query.pageSize;
    return this.repository.listMine({
      memberId: user.id,
      status: query.status,
      skip: (query.page - 1) * pageSize,
      take: pageSize,
    });
  }

  async cancel(user: User, sessionId: string): Promise<CancelledSessionRecord> {
    this.assertMember(user);
    const now = this.clock.now();
    return this.repository.cancel({
      memberId: user.id,
      sessionId,
      now,
      earliestStartsAt: cancellationDeadline(now),
    });
  }

  private assertMember(user: User): void {
    if (user.role !== UserRole.MIEMBRO) {
      throw new DomainError('FORBIDDEN', 'Acceso denegado.');
    }
  }
}
