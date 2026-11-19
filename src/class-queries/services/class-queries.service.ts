import { Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { DomainError } from '@Common/errors';
import { addDays, GymClock, isCalendarDate } from '@Common/time';
import type { ClassSessionsQueryDto } from '../dto/class-sessions-query.dto.js';
import {
  ClassSessionRepository,
  type ClassSessionSearch,
  type ClassSessionSnapshot,
} from '../repositories/class-session.repository.js';

const LOCAL_UTC_OFFSET_MINUTES = 6 * 60;

export interface ClassSessionsPage extends ClassSessionSnapshot {
  page: number;
  pageSize: number;
}

@Injectable()
export class ClassQueriesService {
  constructor(
    private readonly classSessionRepository: ClassSessionRepository,
    private readonly gymClock: GymClock,
  ) {}

  async findSessions(query: ClassSessionsQueryDto): Promise<ClassSessionsPage> {
    this.validateQuery(query);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const search: ClassSessionSearch = {
      from: this.localStartOfDay(query.from),
      toExclusive: this.localStartOfDay(addDays(query.to, 1)),
      name: this.normalizeName(query.name),
      roomId: query.roomId,
      trainerId: query.trainerId,
      skip: (page - 1) * pageSize,
      take: pageSize,
    };
    const snapshot =
      await this.classSessionRepository.findAvailableSnapshot(search);
    return { ...snapshot, page, pageSize };
  }

  private validateQuery(query: ClassSessionsQueryDto): void {
    if (!isCalendarDate(query.from) || !isCalendarDate(query.to)) {
      throw new DomainError(
        'INVALID',
        'from y to deben ser fechas civiles válidas con formato YYYY-MM-DD.',
      );
    }
    if (query.to !== addDays(query.from, 6)) {
      throw new DomainError(
        'INVALID',
        'El rango debe abarcar exactamente siete días calendario.',
      );
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
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
    if (query.name !== undefined && typeof query.name !== 'string') {
      throw new DomainError('INVALID', 'name debe ser texto.');
    }
    if (query.name !== undefined && query.name.length > 80) {
      throw new DomainError('INVALID', 'name no puede superar 80 caracteres.');
    }
    if (query.roomId !== undefined && !isUUID(query.roomId, 'all')) {
      throw new DomainError('INVALID', 'roomId debe ser un UUID válido.');
    }
    if (query.trainerId !== undefined && !isUUID(query.trainerId, 'all')) {
      throw new DomainError('INVALID', 'trainerId debe ser un UUID válido.');
    }
  }

  private normalizeName(name: string | undefined): string | undefined {
    const normalized = name?.trim();
    return normalized ? normalized : undefined;
  }

  private localStartOfDay(date: string): Date {
    // dateOnly representa la fecha civil a medianoche UTC; se desplaza seis
    // horas para obtener medianoche local de America/El_Salvador.
    const civilMidnight = this.gymClock.dateOnly(date);
    return new Date(civilMidnight.getTime() + LOCAL_UTC_OFFSET_MINUTES * 60000);
  }
}
