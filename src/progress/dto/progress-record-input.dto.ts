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
  ValidateIf,
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
 * Evita dos marcas del mismo ejercicio en un mismo registro diario.
 *
 * Es el supuesto de producto de H24 («no duplicar el mismo exerciseId») y la
 * base de datos lo sostiene con `@@unique([progressRecordId, exerciseId])`.
 */
@ValidatorConstraint({ name: 'uniqueExerciseMarks', async: false })
class UniqueExerciseMarksConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (!Array.isArray(value)) {
      return true;
    }
    const exerciseIds = value.map(
      (mark) => (mark as ExerciseMarkInputDto | undefined)?.exerciseId,
    );
    return new Set(exerciseIds).size === exerciseIds.length;
  }

  defaultMessage(args?: ValidationArguments): string {
    const property = args?.property ?? 'marks';
    return `${property} no admite dos marcas del mismo ejercicio. field=${property}.exerciseId`;
  }
}

/** Marca de un ejercicio: peso levantado y repeticiones efectivas. */
export class ExerciseMarkInputDto {
  @ApiProperty({
    description: 'Ejercicio activo del catálogo de H22.',
    format: 'uuid',
  })
  @IsUUID('all', { message: 'exerciseId debe ser un UUID válido.' })
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
    { message: 'El peso de la marca admite máximo dos decimales.' },
  )
  @Min(MARK_WEIGHT_KG_MIN, {
    message: `El peso de la marca no puede ser menor que ${MARK_WEIGHT_KG_MIN} kg.`,
  })
  @Max(MARK_WEIGHT_KG_MAX, {
    message: `El peso de la marca no puede superar ${MARK_WEIGHT_KG_MAX} kg.`,
  })
  weightKg!: number;

  @ApiProperty({
    description: 'Repeticiones completadas con ese peso.',
    example: 10,
    minimum: MARK_REPS_MIN,
    maximum: MARK_REPS_MAX,
  })
  @Type(() => Number)
  @IsInt({ message: 'reps debe ser un entero.' })
  @Min(MARK_REPS_MIN, {
    message: `reps debe ser mayor o igual que ${MARK_REPS_MIN}.`,
  })
  @Max(MARK_REPS_MAX, {
    message: `reps no puede superar ${MARK_REPS_MAX}.`,
  })
  reps!: number;
}

/**
 * Cuerpo compartido por `POST /progress-records` y `PATCH /progress-records/:id`
 * (H24, contratos 1 y 2: «mismo contrato, campos editables»).
 *
 * El `memberId` no se acepta en el body: siempre se deriva de la sesión.
 * En `PATCH`, omitir `marks` deja las marcas existentes intactas; enviar un
 * arreglo (incluso vacío) reemplaza el conjunto de marcas del día.
 */
export class ProgressRecordInputDto {
  @ApiProperty({
    description:
      'Día civil de la medición. No puede ser posterior al día del gimnasio.',
    example: '2026-11-10',
    format: 'date',
  })
  @IsString({ message: 'recordDate debe ser una fecha YYYY-MM-DD.' })
  @Validate(CalendarDateConstraint)
  recordDate!: string;

  @ApiProperty({
    description: 'Peso corporal en kilogramos.',
    example: 78.4,
    minimum: WEIGHT_KG_MIN,
    maximum: WEIGHT_KG_MAX,
  })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: DECIMAL_PLACES },
    { message: 'weightKg admite máximo dos decimales.' },
  )
  @Min(WEIGHT_KG_MIN, {
    message: `weightKg no puede ser menor que ${WEIGHT_KG_MIN} kg.`,
  })
  @Max(WEIGHT_KG_MAX, {
    message: `weightKg no puede superar ${WEIGHT_KG_MAX} kg.`,
  })
  weightKg!: number;

  @ApiPropertyOptional({
    description: 'Circunferencia de cintura en centímetros.',
    example: 92.5,
    minimum: MEASURE_CM_MIN,
    maximum: MEASURE_CM_MAX,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: DECIMAL_PLACES },
    { message: 'waistCm admite máximo dos decimales.' },
  )
  @Min(MEASURE_CM_MIN, {
    message: `waistCm no puede ser menor que ${MEASURE_CM_MIN} cm.`,
  })
  @Max(MEASURE_CM_MAX, {
    message: `waistCm no puede superar ${MEASURE_CM_MAX} cm.`,
  })
  waistCm?: number | null;

  @ApiPropertyOptional({
    description: 'Circunferencia de pecho en centímetros.',
    example: 104,
    minimum: MEASURE_CM_MIN,
    maximum: MEASURE_CM_MAX,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: DECIMAL_PLACES },
    { message: 'chestCm admite máximo dos decimales.' },
  )
  @Min(MEASURE_CM_MIN, {
    message: `chestCm no puede ser menor que ${MEASURE_CM_MIN} cm.`,
  })
  @Max(MEASURE_CM_MAX, {
    message: `chestCm no puede superar ${MEASURE_CM_MAX} cm.`,
  })
  chestCm?: number | null;

  @ApiPropertyOptional({
    description: 'Circunferencia de brazo en centímetros.',
    example: 36.2,
    minimum: MEASURE_CM_MIN,
    maximum: MEASURE_CM_MAX,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: DECIMAL_PLACES },
    { message: 'armCm admite máximo dos decimales.' },
  )
  @Min(MEASURE_CM_MIN, {
    message: `armCm no puede ser menor que ${MEASURE_CM_MIN} cm.`,
  })
  @Max(MEASURE_CM_MAX, {
    message: `armCm no puede superar ${MEASURE_CM_MAX} cm.`,
  })
  armCm?: number | null;

  @ApiPropertyOptional({
    description: `Marcas del día: cero o más, máximo ${MAX_MARKS_PER_RECORD}, sin repetir un ejercicio dentro del registro.`,
    type: [ExerciseMarkInputDto],
  })
  // `@IsOptional()` también omite null; H24 distingue el campo omitido de un
  // valor nulo para no convertir PATCH marks:null en un borrado silencioso.
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray({ message: 'marks debe ser un arreglo.' })
  @ArrayMaxSize(MAX_MARKS_PER_RECORD, {
    message: `marks admite como máximo ${MAX_MARKS_PER_RECORD} entradas. field=marks`,
  })
  @Validate(UniqueExerciseMarksConstraint)
  @ValidateNested({ each: true })
  @Type(() => ExerciseMarkInputDto)
  marks?: ExerciseMarkInputDto[];
}
