
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

/**
 * H20 — Filtros para consultar pagos pendientes.
 */
export class PaymentPendingQueryDto {
  @ApiPropertyOptional({
    enum: [
      'MEMBRESIA',
      'SESION_ADICIONAL',
      'SESION_PERSONAL',
    ],
  })
  @IsOptional()
  @IsIn([
    'MEMBRESIA',
    'SESION_ADICIONAL',
    'SESION_PERSONAL',
  ])
  concept?: string;

  @ApiPropertyOptional({
    enum: ['NONE', 'D1_30', 'D31_60', 'OVER_60'],
  })
  @IsOptional()
  @IsIn(['NONE', 'D1_30', 'D31_60', 'OVER_60'])
  overdue?: string;

  @ApiPropertyOptional({
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 50,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 20;
}
