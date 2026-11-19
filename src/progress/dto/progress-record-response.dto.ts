
import { ApiProperty } from '@nestjs/swagger';
import { MAX_PAGE_SIZE } from '../limits.js';

import type {
  ProgressMarkView,
  ProgressRecordView,
} from '../repositories/progress-record.repository.js';

/**
 * Respuesta de una marca de ejercicio.
 */
export class ExerciseMarkResponseDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Ejercicio del catálogo.',
  })
  exerciseId!: string;

  @ApiProperty({
    description: 'Peso levantado en kilogramos.',
    example: 62.5,
  })
  weightKg!: number;

  @ApiProperty({
    description: 'Repeticiones completadas.',
    example: 10,
  })
  reps!: number;

  static fromMark(
    mark: ProgressMarkView,
  ): ExerciseMarkResponseDto {
    return {
      exerciseId: mark.exerciseId,
      weightKg: mark.weightKg,
      reps: mark.reps,
    };
  }
}

/**
 * H24: respuesta de un registro de progreso físico.
 */
export class ProgressRecordResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    description:
      'Día civil del registro (America/El_Salvador).',
    example: '2026-11-10',
    format: 'date',
  })
  recordDate!: string;

  @ApiProperty({
    example: 78.4,
    description: 'Peso corporal en kg.',
  })
  weightKg!: number;

  @ApiProperty({
    example: 92.5,
    nullable: true,
    description: 'Cintura en cm.',
  })
  waistCm!: number | null;

  @ApiProperty({
    example: 104,
    nullable: true,
    description: 'Pecho en cm.',
  })
  chestCm!: number | null;

  @ApiProperty({
    example: 36.2,
    nullable: true,
    description: 'Brazo en cm.',
  })
  armCm!: number | null;

  @ApiProperty({
    description:
      'Indica si es el primer registro cronológico del miembro.',
    example: false,
  })
  isBaseline!: boolean;

  @ApiProperty({
    type: [ExerciseMarkResponseDto],
  })
  marks!: ExerciseMarkResponseDto[];

  static fromView(
    record: ProgressRecordView,
  ): ProgressRecordResponseDto {
    return {
      id: record.id,
      recordDate: record.recordDate,
      weightKg: record.weightKg,
      waistCm: record.waistCm,
      chestCm: record.chestCm,
      armCm: record.armCm,
      isBaseline: record.isBaseline,
      marks: record.marks.map((mark) =>
        ExerciseMarkResponseDto.fromMark(mark),
      ),
    };
  }
}

/**
 * H24: historial paginado de registros físicos.
 */
export class ProgressHistoryResponseDto {
  @ApiProperty({
    type: [ProgressRecordResponseDto],
  })
  data!: ProgressRecordResponseDto[];

  @ApiProperty({
    example: 12,
    description: 'Registros totales del miembro.',
  })
  total!: number;

  @ApiProperty({
    example: 1,
    minimum: 1,
  })
  page!: number;

  @ApiProperty({
    example: 10,
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
  })
  pageSize!: number;

  static fromPage(page: {
    rows: ProgressRecordView[];
    total: number;
    page: number;
    pageSize: number;
  }): ProgressHistoryResponseDto {
    return {
      data: page.rows.map((row) =>
        ProgressRecordResponseDto.fromView(row),
      ),
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
    };
  }
}
