import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  Validate,
} from 'class-validator';
import { MAX_MEMBER_SEARCH_LENGTH, MAX_PAGE_SIZE } from '../limits.js';
import { CalendarDateConstraint } from './calendar-date.constraint.js';

/** Métricas disponibles en la evolución de H25. */
export const PROGRESS_METRICS = [
  'weightKg',
  'waistCm',
  'chestCm',
  'armCm',
  'exerciseWeightKg',
] as const;

export type ProgressMetric = (typeof PROGRESS_METRICS)[number];

function trimValue(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/** Paginación del historial propio (`GET /progress-records/me`). */
export class ProgressHistoryQueryDto {
  @ApiPropertyOptional({
    description: 'Página solicitada, empezando en 1.',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page debe ser un entero.' })
  @Min(1, { message: 'page debe ser mayor o igual que 1.' })
  page = 1;

  @ApiPropertyOptional({
    description: 'Registros por página; la UI pagina de a 10.',
    default: 10,
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize debe ser un entero.' })
  @Min(1, { message: 'pageSize debe ser mayor o igual que 1.' })
  @Max(MAX_PAGE_SIZE, {
    message: `pageSize no puede superar ${MAX_PAGE_SIZE}.`,
  })
  pageSize = 10;
}

/** Filtros de `GET /progress-records/me/evolution` (H25, contrato 1). */
export class EvolutionQueryDto {
  @ApiPropertyOptional({
    description: 'Indicador a graficar. Con exerciseWeightKg exige exerciseId.',
    enum: PROGRESS_METRICS,
    default: 'weightKg',
  })
  @IsOptional()
  @IsIn(PROGRESS_METRICS, {
    message: `metric debe ser uno de: ${PROGRESS_METRICS.join(', ')}.`,
  })
  metric: ProgressMetric = 'weightKg';

  @ApiPropertyOptional({
    description: 'Ejercicio cuyas marcas se grafican.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('all', { message: 'exerciseId debe ser un UUID válido.' })
  exerciseId?: string;

  @ApiPropertyOptional({
    description: 'Primer día civil incluido en la serie.',
    example: '2026-01-01',
    format: 'date',
  })
  @IsOptional()
  @IsString({ message: 'from debe ser una fecha YYYY-MM-DD.' })
  @Validate(CalendarDateConstraint)
  from?: string;

  @ApiPropertyOptional({
    description: 'Último día civil incluido en la serie.',
    example: '2026-12-31',
    format: 'date',
  })
  @IsOptional()
  @IsString({ message: 'to debe ser una fecha YYYY-MM-DD.' })
  @Validate(CalendarDateConstraint)
  to?: string;
}

/** Rango civil de `GET /trainers/me/members/:memberId/progress` (H26). */
export class MemberProgressQueryDto {
  @ApiPropertyOptional({
    description: 'Primer día civil incluido.',
    example: '2026-01-01',
    format: 'date',
  })
  @IsOptional()
  @IsString({ message: 'from debe ser una fecha YYYY-MM-DD.' })
  @Validate(CalendarDateConstraint)
  from?: string;

  @ApiPropertyOptional({
    description: 'Último día civil incluido.',
    example: '2026-12-31',
    format: 'date',
  })
  @IsOptional()
  @IsString({ message: 'to debe ser una fecha YYYY-MM-DD.' })
  @Validate(CalendarDateConstraint)
  to?: string;
}

/** Filtros de `GET /trainers/me/members` (H26, contrato 1). */
export class TrainerMemberQueryDto {
  @ApiPropertyOptional({
    description:
      'Contiene sobre el nombre del miembro o su número, sin distinguir mayúsculas.',
    maxLength: MAX_MEMBER_SEARCH_LENGTH,
    example: 'Maria',
  })
  @IsOptional()
  @Transform(({ value }) => trimValue(value))
  @IsString({ message: 'search debe ser texto.' })
  @MaxLength(MAX_MEMBER_SEARCH_LENGTH, {
    message: `search no puede superar ${MAX_MEMBER_SEARCH_LENGTH} caracteres.`,
  })
  search?: string;

  @ApiPropertyOptional({
    description: 'Página solicitada, empezando en 1.',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page debe ser un entero.' })
  @Min(1, { message: 'page debe ser mayor o igual que 1.' })
  page = 1;

  @ApiPropertyOptional({
    description: 'Miembros por página; la UI pagina de a 10.',
    default: 10,
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize debe ser un entero.' })
  @Min(1, { message: 'pageSize debe ser mayor o igual que 1.' })
  @Max(MAX_PAGE_SIZE, {
    message: `pageSize no puede superar ${MAX_PAGE_SIZE}.`,
  })
  pageSize = 10;
}
