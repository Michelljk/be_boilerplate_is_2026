import { ApiProperty } from '@nestjs/swagger';
import { ReservationStatus } from '@PrismaClient';
import type {
  CancelledClassReservation,
  CreatedClassReservation,
  ListedClassReservation,
} from '../repositories/class-reservation.repository.types.js';

export class CreateClassReservationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  sessionId!: string;

  @ApiProperty({ example: 'Yoga matutino' })
  className!: string;

  @ApiProperty({ format: 'date-time' })
  startsAt!: string;

  @ApiProperty({ format: 'date-time' })
  endsAt!: string;

  @ApiProperty({
    enum: [ReservationStatus.CONFIRMADA],
    default: ReservationStatus.CONFIRMADA,
  })
  status!: ReservationStatus;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  static fromEntity(
    entity: CreatedClassReservation,
  ): CreateClassReservationResponseDto {
    return {
      id: entity.id,
      sessionId: entity.sessionId,
      className: entity.className,
      startsAt: entity.startsAt.toISOString(),
      endsAt: entity.endsAt.toISOString(),
      status: entity.status,
      createdAt: entity.createdAt.toISOString(),
    };
  }
}

export class ClassReservationItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Yoga matutino' })
  className!: string;

  @ApiProperty({ example: 'Ana Pérez' })
  trainerName!: string;

  @ApiProperty({ example: 'Sala 1' })
  roomName!: string;

  @ApiProperty({ format: 'date-time' })
  startsAt!: string;

  @ApiProperty({ format: 'date-time' })
  endsAt!: string;

  @ApiProperty({ enum: ReservationStatus })
  status!: ReservationStatus;

  static fromRow(row: ListedClassReservation): ClassReservationItemDto {
    return {
      id: row.id,
      className: row.className,
      trainerName: row.trainerName,
      roomName: row.roomName,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      status: row.status,
    };
  }
}

export class ClassReservationPageDto {
  @ApiProperty({ type: [ClassReservationItemDto] })
  data!: ClassReservationItemDto[];

  @ApiProperty({ example: 2 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  pageSize!: number;
}

/** Contrato H6: estado final, marca temporal y cupo liberado. */
export class CancelClassReservationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    enum: [ReservationStatus.CANCELADA],
    default: ReservationStatus.CANCELADA,
  })
  status!: ReservationStatus;

  @ApiProperty({ format: 'date-time' })
  cancelledAt!: string;

  @ApiProperty({ example: 4, minimum: 0 })
  freeSpots!: number;

  static fromResult(
    result: CancelledClassReservation,
  ): CancelClassReservationResponseDto {
    return {
      id: result.id,
      status: result.status,
      cancelledAt: result.cancelledAt.toISOString(),
      freeSpots: result.freeSpots,
    };
  }
}
