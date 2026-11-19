
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  Max,
  Min,
  registerDecorator,
  type ValidationOptions,
} from 'class-validator';

import { isCalendarDate } from '../../common/time/gym-clock.service.js';

/**
 * Valida que el valor sea una fecha civil válida.
 * Ejemplo: 2026-11-18.
 */
function CalendarDate(options?: ValidationOptions) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'isCalendarDate',
      target: target.constructor,
      propertyName,
      options,
      validator: {
        validate(value: unknown) {
          return (
            typeof value === 'string' &&
            isCalendarDate(value)
          );
        },
      },
    });
}

/**
 * H18: filtros de búsqueda del historial.
 */
export class PaymentHistoryQueryDto {
  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsISO8601({ strict: true })
  @CalendarDate()
  from?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsISO8601({ strict: true })
  @CalendarDate()
  to?: string;

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
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 10;
}

/**
 * H18: representación individual de un pago.
 */
export class PaymentHistoryItemDto {
  @ApiProperty({ format: 'uuid' })
  paymentId!: string;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
  })
  receiptId!: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description:
      'Puede ser null para un pago ANULADO sin fecha de pago.',
  })
  paidAt!: Date | null;

  @ApiProperty()
  concept!: string;

  @ApiProperty()
  amountUsd!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty({ nullable: true })
  reason!: string | null;
}

/**
 * H18: respuesta paginada del historial.
 */
export class PaymentHistoryResponseDto {
  @ApiProperty({
    type: [PaymentHistoryItemDto],
  })
  data!: PaymentHistoryItemDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty({ maximum: 50 })
  pageSize!: number;
}
