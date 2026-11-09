import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { MachineStatus } from '@PrismaClient';

const REASON_MIN_LENGTH = 10;
const REASON_MAX_LENGTH = 250;

export class MachineIdParamsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;
}

export class CompleteMaintenanceParamsDto extends MachineIdParamsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  maintenanceId!: string;
}

export class OpenMaintenanceDto {
  @ApiProperty({
    description: 'Motivo del mantenimiento.',
    minLength: REASON_MIN_LENGTH,
    maxLength: REASON_MAX_LENGTH,
    example: 'Cambio de correa y revisión general',
  })
  @IsString()
  @MinLength(REASON_MIN_LENGTH)
  @MaxLength(REASON_MAX_LENGTH)
  @Matches(/\S/, { message: 'El motivo no puede estar vacío.' })
  reason!: string;

  @ApiProperty({
    description:
      'Instante ISO-8601 de inicio; puede ser pasado, presente o futuro.',
    format: 'date-time',
    example: '2026-11-08T14:30:00-06:00',
  })
  @IsDateString({ strict: true })
  startsAt!: string;
}

export class CompleteMaintenanceDto {
  @ApiProperty({
    description:
      'Instante ISO-8601 de finalización; debe ser posterior o igual al inicio.',
    format: 'date-time',
    example: '2026-11-09T16:00:00-06:00',
  })
  @IsDateString({ strict: true })
  endedAt!: string;
}

export class ChangeMachineStatusDto {
  @ApiProperty({
    enum: [MachineStatus.DISPONIBLE, MachineStatus.FUERA_SERVICIO],
  })
  @IsEnum(MachineStatus)
  status!: Extract<MachineStatus, 'DISPONIBLE' | 'FUERA_SERVICIO'>;

  @ApiProperty({
    description: 'Motivo del cambio manual.',
    minLength: REASON_MIN_LENGTH,
    maxLength: REASON_MAX_LENGTH,
    example: 'Equipo fuera de servicio por ruido anormal',
  })
  @IsString()
  @MinLength(REASON_MIN_LENGTH)
  @MaxLength(REASON_MAX_LENGTH)
  @Matches(/\S/, { message: 'El motivo no puede estar vacío.' })
  reason!: string;
}

export class ListMachinesQueryDto {
  @ApiPropertyOptional({ enum: MachineStatus })
  @IsOptional()
  @IsEnum(MachineStatus)
  status?: MachineStatus;

  @ApiPropertyOptional({ maxLength: 100, example: 'Sala de pesas' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 20;
}

export class MachineSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ maxLength: 80 })
  name!: string;

  @ApiProperty({ maxLength: 60 })
  type!: string;

  @ApiProperty({ maxLength: 100 })
  location!: string;

  @ApiProperty({ enum: MachineStatus })
  status!: MachineStatus;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class MachineListResponseDto {
  @ApiProperty({ type: [MachineSummaryDto] })
  data!: MachineSummaryDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}

export class OpenMaintenanceResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  machineId!: string;

  @ApiProperty({ format: 'date-time' })
  startedAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  endedAt!: null;

  @ApiProperty({ maxLength: REASON_MAX_LENGTH })
  reason!: string;

  @ApiProperty({ format: 'uuid' })
  createdById!: string;

  @ApiProperty({ enum: [MachineStatus.EN_MANTENIMIENTO] })
  status!: 'EN_MANTENIMIENTO';
}

export class CompleteMaintenanceResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'date-time' })
  endedAt!: Date;

  @ApiProperty({ format: 'uuid' })
  closedById!: string;

  @ApiProperty({ enum: [MachineStatus.DISPONIBLE] })
  machineStatus!: 'DISPONIBLE';
}

export class ChangeMachineStatusResponseDto {
  @ApiProperty({ format: 'uuid' })
  machineId!: string;

  @ApiProperty({
    enum: [MachineStatus.DISPONIBLE, MachineStatus.FUERA_SERVICIO],
  })
  status!: 'DISPONIBLE' | 'FUERA_SERVICIO';

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}
