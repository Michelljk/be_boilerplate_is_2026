import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type {
  ClassSession,
  ClassStatus,
  ClassTemplate,
  Room,
  SessionStatus,
} from '@PrismaClient';

const DURATIONS = [30, 45, 60, 75, 90, 120] as const;

export class CreateClassTemplateDto {
  @ApiProperty({ minLength: 3, maxLength: 80, example: 'Yoga matutino' })
  @IsString()
  @Length(3, 80)
  name!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  trainerId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  roomId!: string;

  @ApiProperty({
    minimum: 1,
    maximum: 7,
    example: 1,
    description: 'Lunes=1, domingo=7',
  })
  @IsInt()
  @Min(1)
  @Max(7)
  weekday!: number;

  @ApiProperty({ pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', example: '07:30' })
  @IsString()
  @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
  startTime!: string;

  @ApiProperty({ enum: DURATIONS, example: 60 })
  @IsInt()
  @IsIn(DURATIONS)
  durationMinutes!: number;

  @ApiProperty({ minimum: 1, maximum: 50, example: 20 })
  @IsInt()
  @Min(1)
  @Max(50)
  capacity!: number;
}

export class UpdateClassTemplateDto {
  @ApiPropertyOptional({ minLength: 3, maxLength: 80 })
  @IsOptional()
  @IsString()
  @Length(3, 80)
  name?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  trainerId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  roomId?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 7 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  weekday?: number;

  @ApiPropertyOptional({ pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' })
  @IsOptional()
  @IsString()
  @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
  startTime?: string;

  @ApiPropertyOptional({ enum: DURATIONS })
  @IsOptional()
  @IsInt()
  @IsIn(DURATIONS)
  durationMinutes?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  capacity?: number;
}

export class GenerateClassSessionsDto {
  @ApiProperty({ format: 'date', example: '2026-11-09' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fromDate!: string;

  @ApiProperty({ format: 'date', example: '2026-11-22' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  toDate!: string;
}

export class UpdateClassSessionDto {
  @ApiPropertyOptional({
    format: 'date-time',
    example: '2026-11-16T15:30:00-06:00',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  startsAt?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  capacity?: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  roomId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  trainerId?: string;
}

export class CancelClassSessionDto {
  @ApiPropertyOptional({ maxLength: 250, example: 'Mantenimiento de la sala' })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  reason?: string;
}

export class ClassTemplateResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty({ format: 'uuid' })
  trainerId!: string;
  @ApiProperty({ format: 'uuid' })
  roomId!: string;
  @ApiProperty()
  weekday!: number;
  @ApiProperty()
  startTime!: string;
  @ApiProperty()
  durationMinutes!: number;
  @ApiProperty()
  capacity!: number;
  @ApiProperty({ enum: ['ACTIVA', 'INACTIVA'] })
  status!: ClassStatus;

  static fromEntity(entity: ClassTemplate): ClassTemplateResponseDto {
    const result = new ClassTemplateResponseDto();
    result.id = entity.id;
    result.name = entity.name;
    result.trainerId = entity.trainerId;
    result.roomId = entity.roomId;
    result.weekday = entity.weekday;
    result.startTime = entity.startTime;
    result.durationMinutes = entity.durationMinutes;
    result.capacity = entity.capacity;
    result.status = entity.status;
    return result;
  }
}

export class GeneratedClassSessionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ format: 'date-time' })
  startsAt!: string;
  @ApiProperty({ format: 'date-time' })
  endsAt!: string;

  static fromEntity(entity: ClassSession): GeneratedClassSessionDto {
    const result = new GeneratedClassSessionDto();
    result.id = entity.id;
    result.startsAt = entity.startsAt.toISOString();
    result.endsAt = entity.endsAt.toISOString();
    return result;
  }
}

export class GenerateClassSessionsResponseDto {
  @ApiProperty()
  created!: number;
  @ApiProperty({ type: [GeneratedClassSessionDto] })
  sessions!: GeneratedClassSessionDto[];
}

export class AdminClassSessionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ format: 'uuid' })
  classTemplateId!: string;
  @ApiProperty({ format: 'date-time' })
  startsAt!: string;
  @ApiProperty({ format: 'date-time' })
  endsAt!: string;
  @ApiProperty()
  capacity!: number;
  @ApiProperty({ format: 'uuid' })
  roomId!: string;
  @ApiProperty({ format: 'uuid' })
  trainerId!: string;
  @ApiProperty({ enum: ['PROGRAMADA', 'EN_CURSO', 'COMPLETADA', 'CANCELADA'] })
  status!: SessionStatus;
  @ApiPropertyOptional({ nullable: true })
  cancelReason!: string | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  cancelledAt!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  cancelledById!: string | null;
  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  static fromEntity(entity: ClassSession): AdminClassSessionResponseDto {
    const result = new AdminClassSessionResponseDto();
    result.id = entity.id;
    result.classTemplateId = entity.classTemplateId;
    result.startsAt = entity.startsAt.toISOString();
    result.endsAt = entity.endsAt.toISOString();
    result.capacity = entity.capacity;
    result.roomId = entity.roomId;
    result.trainerId = entity.trainerId;
    result.status = entity.status;
    result.cancelReason = entity.cancelReason;
    result.cancelledAt = entity.cancelledAt?.toISOString() ?? null;
    result.cancelledById = entity.cancelledById;
    result.updatedAt = entity.updatedAt.toISOString();
    return result;
  }
}

export class CancelAdminClassSessionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ enum: ['CANCELADA'] })
  status!: 'CANCELADA';
  @ApiProperty()
  cancelledReservations!: number;
  @ApiProperty({ format: 'date-time' })
  cancelledAt!: string;
}

export class RoomCatalogDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty()
  capacity!: number;

  static fromEntity(entity: Room): RoomCatalogDto {
    const result = new RoomCatalogDto();
    result.id = entity.id;
    result.name = entity.name;
    result.capacity = entity.capacity;
    return result;
  }
}

export class TrainerCatalogDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  name!: string;
}
