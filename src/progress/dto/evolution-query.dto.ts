
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Validate,
} from 'class-validator';

import { CalendarDateConstraint } from './calendar-date.constraint.js';

/**
 * Métricas disponibles en H25.
 */
export const PROGRESS_METRICS = [
  'weightKg',
  'waistCm',
  'chestCm',
  'armCm',
  'exerciseWeightKg',
] as const;

export type ProgressMetric =
  (typeof PROGRESS_METRICS)[number];

/**
 * H25 — Filtros para consultar la evolución física.
 */
export class EvolutionQueryDto {
  @ApiPropertyOptional({
    description:
      'Indicador a graficar. Con exerciseWeightKg exige exerciseId.',
    enum: PROGRESS_METRICS,
    default: 'weightKg',
  })
  @IsOptional()
  @IsIn(PROGRESS_METRICS, {
    message:
      `metric debe ser uno de: ${PROGRESS_METRICS.join(', ')}.`,
  })
  metric: ProgressMetric = 'weightKg';

  @ApiPropertyOptional({
    description: 'Ejercicio cuyas marcas se grafican.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('all', {
    message: 'exerciseId debe ser un UUID válido.',
  })
  exerciseId?: string;

  @ApiPropertyOptional({
    description: 'Primer día incluido en la serie.',
    example: '2026-01-01',
    format: 'date',
  })
  @IsOptional()
  @IsString({
    message: 'from debe ser una fecha YYYY-MM-DD.',
  })
  @Validate(CalendarDateConstraint)
  from?: string;

  @ApiPropertyOptional({
    description: 'Último día incluido en la serie.',
    example: '2026-12-31',
    format: 'date',
  })
  @IsOptional()
  @IsString({
    message: 'to debe ser una fecha YYYY-MM-DD.',
  })
  @Validate(CalendarDateConstraint)
  to?: string;
}
