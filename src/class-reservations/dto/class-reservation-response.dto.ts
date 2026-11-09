import { ApiProperty } from '@nestjs/swagger';
import { ReservationStatus } from '@PrismaClient';

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
