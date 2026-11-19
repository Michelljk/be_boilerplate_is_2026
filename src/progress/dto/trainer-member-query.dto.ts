
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const MAX_MEMBER_SEARCH_LENGTH = 100;
const MAX_PAGE_SIZE = 50;

function trimValue(value: unknown): unknown {
  return typeof value === 'string'
    ? value.trim()
    : value;
}

/**
 * H26 — Filtros para consultar los miembros
 * asignados al entrenador autenticado.
 */
export class TrainerMemberQueryDto {
  @ApiPropertyOptional({
    description:
      'Búsqueda por nombre o número de miembro.',
    example: 'Maria',
    maxLength: MAX_MEMBER_SEARCH_LENGTH,
  })
  @IsOptional()
  @Transform(({ value }) => trimValue(value))
  @IsString({
    message: 'search debe ser texto.',
  })
  @MaxLength(MAX_MEMBER_SEARCH_LENGTH, {
    message:
      `search no puede superar ${MAX_MEMBER_SEARCH_LENGTH} caracteres.`,
  })
  search?: string;

  @ApiPropertyOptional({
    description: 'Número de página.',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({
    message: 'page debe ser un entero.',
  })
  @Min(1, {
    message: 'page debe ser mayor o igual que 1.',
  })
  page = 1;

  @ApiPropertyOptional({
    description: 'Miembros por página.',
    default: 10,
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({
    message: 'pageSize debe ser un entero.',
  })
  @Min(1, {
    message: 'pageSize debe ser mayor o igual que 1.',
  })
  @Max(MAX_PAGE_SIZE, {
    message:
      `pageSize no puede superar ${MAX_PAGE_SIZE}.`,
  })
  pageSize = 10;
}
