import { Injectable } from '@nestjs/common';
import { DomainError } from '@Common/errors';
import { addDays, GymClock, isCalendarDate } from '@Common/time';
import { UserRole, type TrainerSlot, type User } from '@PrismaClient';
import type {
  CreateTrainerSlotDto,
  ListTrainerSlotsQueryDto,
  UpdateTrainerSlotDto,
} from '../dto/index.js';
import { TrainerSlotRepository } from '../repositories/index.js';

const TEMPORAL_ERROR_MESSAGE = 'El horario debe ser posterior a la hora actual';
const INVALID_DATE_MESSAGE = 'La fecha debe ser una fecha civil válida.';
const INVALID_TIME_MESSAGE =
  'startTime debe estar entre 06:00 y 20:00, con minutos 00.';

@Injectable()
export class TrainerSlotsService {
  constructor(
    private readonly trainerSlotRepository: TrainerSlotRepository,
    private readonly gymClock: GymClock,
  ) {}

  async create(user: User, dto: CreateTrainerSlotDto): Promise<TrainerSlot> {
    this.assertTrainer(user);
    const { startsAt, endsAt } = this.buildFutureSlot(dto.date, dto.startTime);
    return this.trainerSlotRepository.create(user.id, startsAt, endsAt);
  }

  async list(
    user: User,
    query: ListTrainerSlotsQueryDto,
  ): Promise<TrainerSlot[]> {
    this.assertTrainer(user);
    const today = this.gymClock.dateOf(this.gymClock.now());
    const from = query.from ?? today;
    const to = query.to;
    if (!isCalendarDate(from) || (to !== undefined && !isCalendarDate(to))) {
      throw new DomainError('INVALID', INVALID_DATE_MESSAGE);
    }
    if (to !== undefined && from > to) {
      throw new DomainError('INVALID', 'from no puede ser posterior a to.');
    }
    const snapshot = await this.trainerSlotRepository.listByTrainer(
      user.id,
      this.gymClock.dateOnly(from),
      to === undefined ? undefined : this.gymClock.dateOnly(addDays(to, 1)),
    );
    return snapshot.slots;
  }

  async update(
    user: User,
    id: string,
    dto: UpdateTrainerSlotDto,
  ): Promise<TrainerSlot> {
    this.assertTrainer(user);
    const { startsAt, endsAt } = this.buildFutureSlot(dto.date, dto.startTime);
    return this.trainerSlotRepository.updateOwnedFree(
      id,
      user.id,
      startsAt,
      endsAt,
    );
  }

  async remove(user: User, id: string): Promise<void> {
    this.assertTrainer(user);
    await this.trainerSlotRepository.deleteOwnedFree(id, user.id);
  }

  private assertTrainer(user: User): void {
    if (user.role !== UserRole.ENTRENADOR) {
      throw new DomainError('FORBIDDEN', 'Acceso denegado.');
    }
  }

  private buildFutureSlot(
    date: string,
    startTime: string,
  ): { startsAt: Date; endsAt: Date } {
    if (!isCalendarDate(date))
      throw new DomainError('INVALID', INVALID_DATE_MESSAGE);
    if (!/^\d{2}:00$/.test(startTime)) {
      throw new DomainError('INVALID', INVALID_TIME_MESSAGE);
    }
    const hour = Number(startTime.slice(0, 2));
    if (hour < 6 || hour > 20)
      throw new DomainError('INVALID', INVALID_TIME_MESSAGE);

    const now = this.gymClock.now();
    const today = this.gymClock.dateOf(now);
    if (date < today || date > addDays(today, 15)) {
      throw new DomainError('INVALID', TEMPORAL_ERROR_MESSAGE);
    }

    const startsAt = new Date(`${date}T${startTime}:00-06:00`);
    if (!Number.isFinite(startsAt.getTime()) || startsAt <= now) {
      throw new DomainError('INVALID', TEMPORAL_ERROR_MESSAGE);
    }
    return { startsAt, endsAt: new Date(startsAt.getTime() + 60 * 60 * 1000) };
  }
}
