
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  type ValidationArguments,
} from 'class-validator';

import {
  DECIMAL_PLACES,
  MARK_REPS_MAX,
  MARK_REPS_MIN,
  MARK_WEIGHT_KG_MAX,
  MARK_WEIGHT_KG_MIN,
  MAX_MARKS_PER_RECORD,
  MEASURE_CM_MAX,
  MEASURE_CM_MIN,
  WEIGHT_KG_MAX,
  WEIGHT_KG_MIN,
} from '../limits.js';

import { CalendarDateConstraint } from './calendar-date.constraint.js';

/**
 * Evita dos marcas del mismo ejercicio
 * dentro de un mismo registro diario.
 */
@ValidatorConstraint({
  name: 'uniqueExerciseMarks',
  async: false,
})
class UniqueExerciseMarksConstraint
  implements ValidatorConstraintInterface
{
  validate(value: unknown): boolean {
    if (!Array.isArray(value)) {
      return true;
    }

    const exerciseIds = value.map(
      (mark) =>
        (mark as ExerciseMarkInputDto | undefined)
          ?.exerciseId,
    );

    return new Set(exerciseIds).size === exerciseIds.length;
  }

  defaultMessage(args?: ValidationArguments): string {
    const property = args?.property ?? 'marks';

    return `${property} no admite dos marcas del mismo ejercicio. field=${property}.exerciseId`;
  }
}

/**
 * Marca de un ejercicio:
 * peso levantado y repeticiones.
 */
export class ExerciseMarkInputDto {
  @ApiProperty({
    description: 'Ejercicio activo del catálogo de H22.',
    format: 'uuid',
  })
  @IsUUID('all', {
    message: 'exerciseId debe ser un UUID válido.',
  })
  exerciseId!: string;

  @ApiProperty({
    description: 'Peso levantado en kilogramos.',
    example: 62.5,
    minimum: MARK_WEIGHT_KG_MIN,
    maximum: MARK_WEIGHT_KG_MAX,
  })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: DECIMAL_PLACES },
    {
      message:
        'El peso de la marca admite máximo dos decimales.',
    },
  )
  @Min(MARK_WEIGHT_KG_MIN)
  @Max(MARK_WEIGHT_KG_MAX)
  weightKg!: number;

  @ApiProperty({
    description: 'Repeticiones completadas.',
    example: 10,
    minimum: MARK_REPS_MIN,
    maximum: MARK_REPS_MAX,
  })
  @Type(() => Number)
  @IsInt()
  @Min(MARK_REPS_MIN)
  @Max(MARK_REPS_MAX)
  reps!: number;
}

/**
 * H24: datos de entrada para registrar o editar progreso.
 * El memberId se obtiene del usuario autenticado.
 */
export class ProgressRecordInputDto {
  @ApiProperty({
    description: 'Día civil de la medición.',
    example: '2026-11-10',
    format: 'date',
  })
  @IsString()
  @Validate(CalendarDateConstraint)
  recordDate!: string;

  @ApiProperty({
    description: 'Peso corporal en kilogramos.',
    example: 78.4,
    minimum: WEIGHT_KG_MIN,
    maximum: WEIGHT_KG_MAX,
  })
  @Type(() => Number)
  @IsNumber({
    maxDecimalPlaces: DECIMAL_PLACES,
  })
  @Min(WEIGHT_KG_MIN)
  @Max(WEIGHT_KG_MAX)
  weightKg!: number;

  @ApiPropertyOptional({
    description: 'Cintura en centímetros.',
    example: 92.5,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({
    maxDecimalPlaces: DECIMAL_PLACES,
  })
  @Min(MEASURE_CM_MIN)
  @Max(MEASURE_CM_MAX)
  waistCm?: number | null;

  @ApiPropertyOptional({
    description: 'Pecho en centímetros.',
    example: 104,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({
    maxDecimalPlaces: DECIMAL_PLACES,
  })
  @Min(MEASURE_CM_MIN)
  @Max(MEASURE_CM_MAX)
  chestCm?: number | null;

  @ApiPropertyOptional({
    description: 'Brazo en centímetros.',
    example: 36.2,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({
    maxDecimalPlaces: DECIMAL_PLACES,
  })
  @Min(MEASURE_CM_MIN)
  @Max(MEASURE_CM_MAX)
  armCm?: number | null;

  @ApiPropertyOptional({
    description: 'Marcas de ejercicios del día.',
    type: [ExerciseMarkInputDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_MARKS_PER_RECORD)
  @Validate(UniqueExerciseMarksConstraint)
  @ValidateNested({ each: true })
  @Type(() => ExerciseMarkInputDto)
  marks?: ExerciseMarkInputDto[];
}
