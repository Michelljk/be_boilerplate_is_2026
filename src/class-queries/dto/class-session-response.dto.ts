import { ApiProperty } from '@nestjs/swagger';
import { SessionStatus } from '@PrismaClient';
import { DomainError } from '@Common/errors';
import type { ClassSessionListingRow } from '../repositories/class-session.repository.js';

interface ClassSessionsResponsePage {
  rows: ClassSessionListingRow[];
  total: number;
  page: number;
  pageSize: number;
}

export class ClassSessionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    description: 'UUID de la plantilla de clase.',
    format: 'uuid',
  })
  classId!: string;

  @ApiProperty({ example: 'Spinning' })
  className!: string;

  @ApiProperty({ example: 'Ana Entrenadora' })
  trainerName!: string;

  @ApiProperty({ example: 'Sala de spinning' })
  roomName!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  startsAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  endsAt!: Date;

  @ApiProperty({ example: 60, minimum: 1 })
  durationMinutes!: number;

  @ApiProperty({ example: 20, minimum: 0 })
  capacity!: number;

  @ApiProperty({ example: 7, minimum: 0 })
  freeSpots!: number;

  @ApiProperty({ enum: SessionStatus, enumName: 'SessionStatus' })
  status!: SessionStatus;

  static fromRow(row: ClassSessionListingRow): ClassSessionResponseDto {
    const durationMinutes =
      (row.endsAt.getTime() - row.startsAt.getTime()) / 60000;
    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
      throw new DomainError(
        'INVALID',
        'La sesión tiene una duración inválida.',
      );
    }

    return {
      id: row.id,
      classId: row.classTemplateId,
      className: row.className,
      trainerName: row.trainerName,
      roomName: row.roomName,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      durationMinutes,
      capacity: row.capacity,
      freeSpots: Math.max(0, row.capacity - row.confirmedCount),
      status: row.status,
    };
  }
}

export class ClassSessionsResponseDto {
  @ApiProperty({ type: [ClassSessionResponseDto] })
  data!: ClassSessionResponseDto[];

  @ApiProperty({ example: 1, minimum: 0 })
  total!: number;

  @ApiProperty({ example: 1, minimum: 1 })
  page!: number;

  @ApiProperty({ example: 10, minimum: 1, maximum: 50 })
  pageSize!: number;

  static fromPage(page: ClassSessionsResponsePage): ClassSessionsResponseDto {
    return {
      data: page.rows.map((row) => ClassSessionResponseDto.fromRow(row)),
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
    };
  }
}
