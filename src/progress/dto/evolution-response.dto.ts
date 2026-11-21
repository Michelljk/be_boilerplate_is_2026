
import { ApiProperty } from '@nestjs/swagger';

import type { ProgressMetric } from './evolution-query.dto.js';

/**
 * H25: un punto de la gráfica de evolución física.
 */
export class EvolutionPointResponseDto {
  @ApiProperty({
    example: '2026-11-10',
    format: 'date',
  })
  date!: string;

  @ApiProperty({
    example: 78.4,
    description: 'Valor medido del indicador.',
  })
  value!: number;

  @ApiProperty({
    example: 10,
    nullable: true,
    description:
      'Repeticiones; solo aplica a exerciseWeightKg.',
  })
  reps!: number | null;
}

/**
 * Contrato de datos que entrega la lógica de evolución.
 * Esta interfaz permite mantener el DTO separado de H24.
 */
export interface EvolutionView {
  metric: ProgressMetric;
  unit: 'kg' | 'cm';
  points: {
    date: string;
    value: number;
    reps: number | null;
  }[];
  baseline: number | null;
  latest: number | null;
  difference: number | null;
  count: number;
}

/**
 * H25: respuesta de evolución física del miembro.
 */
export class EvolutionResponseDto {
  @ApiProperty({
    enum: ['kg', 'cm'],
    example: 'kg',
    description: 'kg para pesos, cm para medidas.',
  })
  unit!: 'kg' | 'cm';

  @ApiProperty({
    example: 'weightKg',
    description: 'Indicador graficado.',
  })
  metric!: ProgressMetric;

  @ApiProperty({
    type: [EvolutionPointResponseDto],
  })
  points!: EvolutionPointResponseDto[];

  @ApiProperty({
    example: 80.2,
    nullable: true,
  })
  baseline!: number | null;

  @ApiProperty({
    example: 77.5,
    nullable: true,
  })
  latest!: number | null;

  @ApiProperty({
    example: -2.7,
    nullable: true,
    description:
      'Último valor menos primer valor. Null si hay menos de dos puntos.',
  })
  difference!: number | null;

  @ApiProperty({
    example: 8,
    description: 'Cantidad de puntos con mediciones reales.',
  })
  count!: number;

  static fromView(
    view: EvolutionView,
  ): EvolutionResponseDto {
    return {
      metric: view.metric,
      unit: view.unit,
      points: view.points.map((point) => ({
        date: point.date,
        value: point.value,
        reps: point.reps,
      })),
      baseline: view.baseline,
      latest: view.latest,
      difference: view.difference,
      count: view.count,
    };
  }
}
