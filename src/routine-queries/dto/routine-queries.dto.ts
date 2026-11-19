import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

function parseStrictBoolean(value: unknown): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

function parseStrictInteger(value: unknown): unknown {
  if (typeof value !== 'string' || !/^[0-9]+$/.test(value)) return value;
  return Number(value);
}

export class RoutineQueryDto {
  @ApiPropertyOptional({
    description: 'Incluye el historial paginado.',
    default: true,
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean({ message: 'includeHistory debe ser true o false.' })
  @Transform(({ value }) => parseStrictBoolean(value), { toClassOnly: true })
  includeHistory?: boolean;

  @ApiPropertyOptional({
    description: 'Página del historial, empezando en 1.',
    default: 1,
    minimum: 1,
    type: Number,
  })
  @IsOptional()
  @IsInt({ message: 'page debe ser un entero.' })
  @Min(1, { message: 'page debe ser mayor o igual que 1.' })
  @Transform(({ value }) => parseStrictInteger(value), { toClassOnly: true })
  page?: number;

  @ApiPropertyOptional({
    description: 'Cantidad de versiones por página.',
    default: 10,
    minimum: 1,
    maximum: 50,
    type: Number,
  })
  @IsOptional()
  @IsInt({ message: 'pageSize debe ser un entero.' })
  @Min(1, { message: 'pageSize debe ser mayor o igual que 1.' })
  @Max(50, { message: 'pageSize no puede superar 50.' })
  @Transform(({ value }) => parseStrictInteger(value), { toClassOnly: true })
  pageSize?: number;
}

export class RoutineIdParamsDto {
  @ApiProperty({ format: 'uuid', description: 'Identificador de la rutina.' })
  @IsUUID('4', {
    message: 'El identificador de rutina debe ser un UUID válido.',
  })
  id!: string;
}

export class RoutineExerciseResponseDto {
  @ApiProperty({ example: 'Sentadilla' })
  exerciseName!: string;

  @ApiProperty({ example: 1, minimum: 1, maximum: 7 })
  weekday!: number;

  @ApiProperty({ example: 3, minimum: 1, maximum: 10 })
  sets!: number;

  @ApiProperty({ example: 10, minimum: 1, maximum: 100 })
  reps!: number;

  @ApiProperty({ example: 1, minimum: 1, maximum: 50 })
  position!: number;
}

export class RoutineDetailResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Rutina de fuerza' })
  name!: string;

  @ApiProperty({ example: 'Mejorar fuerza general' })
  goal!: string;

  @ApiProperty({ example: 'Gabriel Antonio Urquilla Zetino' })
  trainerName!: string;

  @ApiProperty({ example: 2 })
  version!: number;

  @ApiProperty({ example: '2026-11-01', format: 'date' })
  startsOn!: string;

  @ApiProperty({ example: '2026-11-30', format: 'date' })
  endsOn!: string;

  @ApiProperty({ enum: ['VIGENTE', 'REEMPLAZADA', 'FINALIZADA'] })
  status!: string;

  @ApiProperty({ type: RoutineExerciseResponseDto, isArray: true })
  exercises!: RoutineExerciseResponseDto[];
}

export class RoutineHistoryItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 1 })
  version!: number;

  @ApiProperty({ enum: ['VIGENTE', 'REEMPLAZADA', 'FINALIZADA'] })
  status!: string;

  @ApiProperty({ example: '2026-10-01', format: 'date' })
  startsOn!: string;

  @ApiProperty({ example: '2026-10-31', format: 'date' })
  endsOn!: string;
}

export class RoutineHistoryPageResponseDto {
  @ApiProperty({ type: RoutineHistoryItemResponseDto, isArray: true })
  data!: RoutineHistoryItemResponseDto[];

  @ApiProperty({ example: 4 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  pageSize!: number;
}

export class RoutineQueriesResponseDto {
  @ApiProperty({ type: RoutineDetailResponseDto, nullable: true })
  current!: RoutineDetailResponseDto | null;

  @ApiProperty({ type: RoutineHistoryPageResponseDto })
  history!: RoutineHistoryPageResponseDto;
}

export type RoutineQueriesInput = Pick<
  RoutineQueryDto,
  'includeHistory' | 'page' | 'pageSize'
>;
