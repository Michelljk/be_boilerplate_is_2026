
import { Injectable } from '@nestjs/common';
import { UserRole } from '@PrismaClient';
import { DomainError } from '@Common/errors';
import { GymClock } from '@Common/time';
import type { User } from '@PrismaClient';

import {
  ClassReservationItemDto,
  CreateClassReservationResponseDto,
  CancelClassReservationResponseDto,
} from '../dto/index.js';

import type {
  ClassReservationPageDto,
  CreateClassReservationDto,
  ListClassReservationsQueryDto,
} from '../dto/index.js';

import { ClassReservationRepository } from '../repositories/index.js';
import type { CancelledClassReservation } from '../repositories/index.js';

const FORBIDDEN_MESSAGE =
  'Solo los miembros pueden gestionar reservas.';

@Injectable()
export class ClassReservationsService {
  constructor(
    private readonly repository: ClassReservationRepository,
    private readonly clock: GymClock,
  ) {}

  async create(
    user: User,
    dto: CreateClassReservationDto,
  ): Promise<CreateClassReservationResponseDto> {
    this.assertMember(user);

    const reservation = await this.repository.create(
      user.id,
      dto.sessionId,
      this.clock.now(),
      this.clock.today(),
    );

    return CreateClassReservationResponseDto.fromEntity(reservation);
  }

  async listMine(
    user: User,
    query: ListClassReservationsQueryDto,
  ): Promise<ClassReservationPageDto> {
    this.assertMember(user);

    const snapshot = await this.repository.listMine(user.id, {
      status: query.status,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });

    const data: ClassReservationItemDto[] = snapshot.rows.map(
      (row) => ClassReservationItemDto.fromRow(row),
    );

    return {
      data,
      total: snapshot.total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /**
   * H6: cancelar una reserva del miembro autenticado.
   */
  async cancel(
    user: User,
    id: string,
  ): Promise<CancelClassReservationResponseDto> {
    this.assertMember(user);

    const cancelled: CancelledClassReservation =
      await this.repository.cancelOwn(
        id,
        user.id,
        this.clock.now(),
      );

    return CancelClassReservationResponseDto.fromResult(
      cancelled,
    );
  }

  private assertMember(user: User): void {
    if (user.role !== UserRole.MIEMBRO) {
      throw new DomainError(
        'FORBIDDEN',
        FORBIDDEN_MESSAGE,
      );
    }
  }
}
