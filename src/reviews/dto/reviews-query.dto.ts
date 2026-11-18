import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import type { ReviewGroupBy, ReviewSort } from '../repositories/index.js';

/** Convierte `''` en `undefined` para que operen los valores por defecto. */
function emptyToUndefined({ value }: { value: unknown }): unknown {
  return value === '' ? undefined : value;
}

/**
 * `GET /api/v1/reviews/eligible-sessions` (H29).
 * El PDF fija `page:int>=1` y `pageSize:int 1..20`.
 */
export class EligibleSessionsQueryDto {
  @ApiPropertyOptional({
    description: 'Página (inicia en 1).',
    example: 1,
    default: 1,
    minimum: 1,
    type: Number,
  })
  @IsOptional()
  @Transform(emptyToUndefined)
  @Type(() => Number)
  @IsInt({ message: 'page debe ser un entero.' })
  @Min(1, { message: 'page debe ser mayor o igual que 1.' })
  page = 1;

  @ApiPropertyOptional({
    description: 'Sesiones por página.',
    example: 10,
    default: 10,
    minimum: 1,
    maximum: 20,
    type: Number,
  })
  @IsOptional()
  @Transform(emptyToUndefined)
  @Type(() => Number)
  @IsInt({ message: 'pageSize debe ser un entero.' })
  @Min(1, { message: 'pageSize debe ser mayor o igual que 1.' })
  @Max(20, { message: 'pageSize no puede superar 20.' })
  pageSize = 10;
}

/**
 * `GET /api/v1/reviews/averages` (H30).
 * El PDF fija `groupBy` obligatorio, `sort` opcional y `pageSize:int 1..50`.
 */
export class ReviewAveragesQueryDto {
  @ApiProperty({
    description:
      'Agrupación del promedio. `class` cubre las plantillas ACTIVA; `trainer` cubre todos los entrenadores.',
    enum: ['class', 'trainer'],
    example: 'class',
  })
  @IsIn(['class', 'trainer'], { message: 'groupBy debe ser class o trainer.' })
  groupBy!: ReviewGroupBy;

  @ApiPropertyOptional({
    description:
      'Orden del promedio; las entidades sin calificaciones van al final.',
    enum: ['asc', 'desc'],
    example: 'desc',
    default: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'], { message: 'sort debe ser asc o desc.' })
  sort: ReviewSort = 'desc';

  @ApiPropertyOptional({
    description: 'Página (inicia en 1).',
    example: 1,
    default: 1,
    minimum: 1,
    type: Number,
  })
  @IsOptional()
  @Transform(emptyToUndefined)
  @Type(() => Number)
  @IsInt({ message: 'page debe ser un entero.' })
  @Min(1, { message: 'page debe ser mayor o igual que 1.' })
  page = 1;

  @ApiPropertyOptional({
    description: 'Entidades por página.',
    example: 20,
    default: 20,
    minimum: 1,
    maximum: 50,
    type: Number,
  })
  @IsOptional()
  @Transform(emptyToUndefined)
  @Type(() => Number)
  @IsInt({ message: 'pageSize debe ser un entero.' })
  @Min(1, { message: 'pageSize debe ser mayor o igual que 1.' })
  @Max(50, { message: 'pageSize no puede superar 50.' })
  pageSize = 20;
}
