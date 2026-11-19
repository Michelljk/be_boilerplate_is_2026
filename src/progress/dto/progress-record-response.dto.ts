import { ApiProperty } from '@nestjs/swagger';
import { MAX_PAGE_SIZE } from '../limits.js';
import type {
  EvolutionView,
  ProgressMarkView,
  ProgressRecordView,
} from '../repositories/progress-record.repository.js';
import type { ProgressMetric } from './progress-query.dto.js';

export class ExerciseMarkResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Ejercicio del catálogo.' })
  exerciseId!: string;

  @ApiProperty({ description: 'Peso levantado en kilogramos.', example: 62.5 })
  weightKg!: number;

  @ApiProperty({ description: 'Repeticiones completadas.', example: 10 })
  reps!: number;

  static fromMark(mark: ProgressMarkView): ExerciseMarkResponseDto {
    return {
      exerciseId: mark.exerciseId,
      weightKg: mark.weightKg,
      reps: mark.reps,
    };
  }
}

export class ProgressRecordResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    description: 'Día civil del registro (America/El_Salvador).',
    example: '2026-11-10',
    format: 'date',
  })
  recordDate!: string;

  @ApiProperty({ example: 78.4, description: 'Peso corporal en kg.' })
  weightKg!: number;

  @ApiProperty({ example: 92.5, nullable: true, description: 'Cintura en cm.' })
  waistCm!: number | null;

  @ApiProperty({ example: 104, nullable: true, description: 'Pecho en cm.' })
  chestCm!: number | null;

  @ApiProperty({ example: 36.2, nullable: true, description: 'Brazo en cm.' })
  armCm!: number | null;

  @ApiProperty({
    description:
      'Verdadero solo en el registro con la fecha más antigua del miembro («Punto de partida»). Se calcula, no se envía ni se guarda.',
    example: false,
  })
  isBaseline!: boolean;

  @ApiProperty({ type: [ExerciseMarkResponseDto] })
  marks!: ExerciseMarkResponseDto[];

  static fromView(record: ProgressRecordView): ProgressRecordResponseDto {
    return {
      id: record.id,
      recordDate: record.recordDate,
      weightKg: record.weightKg,
      waistCm: record.waistCm,
      chestCm: record.chestCm,
      armCm: record.armCm,
      isBaseline: record.isBaseline,
      marks: record.marks.map((mark) => ExerciseMarkResponseDto.fromMark(mark)),
    };
  }
}

export class ProgressHistoryResponseDto {
  @ApiProperty({ type: [ProgressRecordResponseDto] })
  data!: ProgressRecordResponseDto[];

  @ApiProperty({ example: 12, description: 'Registros totales del miembro.' })
  total!: number;

  @ApiProperty({ example: 1, minimum: 1 })
  page!: number;

  @ApiProperty({ example: 10, minimum: 1, maximum: MAX_PAGE_SIZE })
  pageSize!: number;

  static fromPage(page: {
    rows: ProgressRecordView[];
    total: number;
    page: number;
    pageSize: number;
  }): ProgressHistoryResponseDto {
    return {
      data: page.rows.map((row) => ProgressRecordResponseDto.fromView(row)),
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
    };
  }
}

export class EvolutionPointResponseDto {
  @ApiProperty({ example: '2026-11-10', format: 'date' })
  date!: string;

  @ApiProperty({ example: 78.4, description: 'Valor medido del indicador.' })
  value!: number;

  @ApiProperty({
    example: 10,
    nullable: true,
    description:
      'Repeticiones de la marca; solo aplica a metric=exerciseWeightKg.',
  })
  reps!: number | null;
}

export class EvolutionResponseDto {
  @ApiProperty({
    enum: ['kg', 'cm'],
    example: 'kg',
    description: 'Unidad del indicador: kg para pesos, cm para medidas.',
  })
  unit!: 'kg' | 'cm';

  @ApiProperty({
    description: 'Métrica graficada en la serie.',
    example: 'weightKg',
  })
  metric!: ProgressMetric;

  @ApiProperty({ type: [EvolutionPointResponseDto] })
  points!: EvolutionPointResponseDto[];

  @ApiProperty({ example: 80.2, nullable: true })
  baseline!: number | null;

  @ApiProperty({ example: 77.5, nullable: true })
  latest!: number | null;

  @ApiProperty({
    example: -2.7,
    nullable: true,
    description: 'latest - baseline; null con menos de dos puntos medibles.',
  })
  difference!: number | null;

  @ApiProperty({ example: 8, description: 'Puntos con dato real en la serie.' })
  count!: number;

  static fromView(view: EvolutionView): EvolutionResponseDto {
    return {
      metric: view.metric,
      unit: view.unit,
      points: view.points.map((point) => ({ ...point })),
      baseline: view.baseline,
      latest: view.latest,
      difference: view.difference,
      count: view.count,
    };
  }
}
