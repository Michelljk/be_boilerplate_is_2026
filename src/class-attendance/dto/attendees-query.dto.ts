
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

/**
 * H8 — Parámetros para consultar los
 * miembros inscritos en una sesión grupal.
 */
export class AttendeesQueryDto {
  @ApiPropertyOptional({
    description: 'Número de página que se desea consultar.',
    example: 1,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({
    message: 'page debe ser un número entero.',
  })
  @Min(1, {
    message: 'page debe ser mayor o igual a 1.',
  })
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Cantidad de miembros por página.',
    example: 10,
    default: 10,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({
    message: 'pageSize debe ser un número entero.',
  })
  @Min(1, {
    message: 'pageSize debe ser mayor o igual a 1.',
  })
  @Max(50, {
    message: 'pageSize no puede superar 50.',
  })
  pageSize: number = 10;
}
