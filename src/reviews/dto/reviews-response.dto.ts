import { ApiProperty } from '@nestjs/swagger';
import type {
  AverageRow,
  EligibleSessionRow,
  ReviewRecord,
} from '../repositories/index.js';

/** Ítem de `GET /api/v1/reviews/eligible-sessions`. */
export class EligibleSessionResponseDto {
  @ApiProperty({ format: 'uuid' })
  sessionId!: string;

  @ApiProperty({ example: 'Spinning' })
  className!: string;

  @ApiProperty({ example: 'Ana Entrenadora' })
  trainerName!: string;

  @ApiProperty({
    description: 'CIERRE real de la sesión: COALESCE(completed_at, ends_at).',
    type: String,
    format: 'date-time',
    example: '2026-11-09T18:00:00.000Z',
  })
  completedAt!: string;

  static fromRow(row: EligibleSessionRow): EligibleSessionResponseDto {
    return Object.assign(new EligibleSessionResponseDto(), {
      sessionId: row.sessionId,
      className: row.className,
      trainerName: row.trainerName,
      completedAt: row.completedAt.toISOString(),
    });
  }
}

/** Envolvente de sesiones evaluables: el PDF solo pide `{data,total}`. */
export class EligibleSessionsResponseDto {
  @ApiProperty({ type: [EligibleSessionResponseDto] })
  data!: EligibleSessionResponseDto[];

  @ApiProperty({ example: 3, minimum: 0 })
  total!: number;

  static fromRows(
    rows: EligibleSessionRow[],
    total: number,
  ): EligibleSessionsResponseDto {
    return Object.assign(new EligibleSessionsResponseDto(), {
      data: rows.map((row) => EligibleSessionResponseDto.fromRow(row)),
      total,
    });
  }
}

/** Cuerpo de `POST /api/v1/reviews` (201). */
export class ReviewResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  sessionId!: string;

  @ApiProperty({ format: 'uuid', description: 'Miembro autenticado (JWT).' })
  memberId!: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  rating!: number;

  @ApiProperty({ example: 'Buena energía.', nullable: true, type: String })
  comment!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  static fromRecord(review: ReviewRecord): ReviewResponseDto {
    return Object.assign(new ReviewResponseDto(), {
      id: review.id,
      sessionId: review.sessionId,
      memberId: review.memberId,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt.toISOString(),
    });
  }
}

/** Ítem de `GET /api/v1/reviews/averages`. */
export class AverageResponseDto {
  @ApiProperty({ format: 'uuid' })
  entityId!: string;

  @ApiProperty({ example: 'Spinning' })
  name!: string;

  @ApiProperty({ example: 12, minimum: 0 })
  reviewCount!: number;

  @ApiProperty({
    description:
      'Promedio redondeado a 1 decimal; null si no hay evaluaciones.',
    example: 4.3,
    nullable: true,
    type: Number,
    format: 'float',
  })
  averageRating!: number | null;

  static fromRow(row: AverageRow): AverageResponseDto {
    return Object.assign(new AverageResponseDto(), {
      entityId: row.entityId,
      name: row.name,
      reviewCount: row.reviewCount,
      averageRating: row.averageRating,
    });
  }
}

/** Envolvente de promedios: `{data,total,page,pageSize}` según H30. */
export class AveragesResponseDto {
  @ApiProperty({ type: [AverageResponseDto] })
  data!: AverageResponseDto[];

  @ApiProperty({ example: 8, minimum: 0 })
  total!: number;

  @ApiProperty({ example: 1, minimum: 1 })
  page!: number;

  @ApiProperty({ example: 20, minimum: 1, maximum: 50 })
  pageSize!: number;

  static fromPage(page: {
    rows: AverageRow[];
    total: number;
    page: number;
    pageSize: number;
  }): AveragesResponseDto {
    return Object.assign(new AveragesResponseDto(), {
      data: page.rows.map((row) => AverageResponseDto.fromRow(row)),
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
    });
  }
}
