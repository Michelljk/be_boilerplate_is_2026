import { Injectable } from '@nestjs/common';
import { UserRole } from '@PrismaClient';
import { DomainError } from '@Common/errors';
import { GymClock } from '@Common/time';
import type { User } from '@PrismaClient';
import type {
  CreateClassReservationDto,
  CreateClassReservationResponseDto,
  ClassReservationItemDto,
  ClassReservationPageDto,
  ListClassReservationsQueryDto,
} from '../dto/index.js';
import { ClassReservationRepository } from '../repositories/class-reservation.repository.js';

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
    return {
      id: reservation.id,
      sessionId: reservation.sessionId,
      className: reservation.className,
      startsAt: reservation.startsAt.toISOString(),
      endsAt: reservation.endsAt.toISOString(),
      status: reservation.status,
      createdAt: reservation.createdAt.toISOString(),
    };
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
    const data: ClassReservationItemDto[] = snapshot.rows.map((row) => ({
      id: row.id,
      className: row.className,
      trainerName: row.trainerName,
      roomName: row.roomName,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      status: row.status,
    }));
    return {
      data,
      total: snapshot.total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  private assertMember(user: User): void {
    if (user.role !== UserRole.MIEMBRO) {
      throw new DomainError(
        'FORBIDDEN',
        'Solo los miembros pueden gestionar reservas.',
      );
    }
  }
}
