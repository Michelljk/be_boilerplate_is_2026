import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { isCalendarDate } from '../../common/time/gym-clock.service.js';
import { Type } from 'class-transformer';
import { registerDecorator, type ValidationOptions } from 'class-validator';
function CalendarDate(options?: ValidationOptions) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'isCalendarDate',
      target: target.constructor,
      propertyName,
      options,
      validator: {
        validate(value: unknown) {
          return typeof value === 'string' && isCalendarDate(value);
        },
      },
    });
}
export class CardPaymentDto {
  @ApiProperty({ example: '4111111111111234' })
  @IsString()
  @Matches(/^\d{16}$/)
  cardNumber!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(60) holder!: string;
  @ApiProperty({ example: '12/28' })
  @IsString()
  @Matches(/^(0[1-9]|1[0-2])\/\d{2}$/)
  expiry!: string;
  @ApiProperty() @IsString() @Matches(/^\d{3}$/) cvv!: string;
}
export class CollectPaymentDto {
  @ApiProperty({ enum: ['EFECTIVO', 'TARJETA'] })
  @IsIn(['EFECTIVO', 'TARJETA'])
  method!: 'EFECTIVO' | 'TARJETA';
  @ApiPropertyOptional()
  @ValidateIf((value) => value.method === 'TARJETA')
  @IsString()
  @Matches(/^\d{16}$/)
  cardNumber?: string;
  @ApiPropertyOptional()
  @ValidateIf((value) => value.method === 'TARJETA')
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  holder?: string;
  @ApiPropertyOptional()
  @ValidateIf((value) => value.method === 'TARJETA')
  @IsString()
  @Matches(/^(0[1-9]|1[0-2])\/\d{2}$/)
  expiry?: string;
  @ApiPropertyOptional()
  @ValidateIf((value) => value.method === 'TARJETA')
  @IsString()
  @Matches(/^\d{3}$/)
  cvv?: string;
}
export class VoidPaymentDto {
  @ApiProperty() @IsString() @MinLength(10) @MaxLength(255) reason!: string;
}
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
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;
  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 10;
}
export class PaymentPendingQueryDto {
  @ApiPropertyOptional({
    enum: ['MEMBRESIA', 'SESION_ADICIONAL', 'SESION_PERSONAL'],
  })
  @IsOptional()
  @IsIn(['MEMBRESIA', 'SESION_ADICIONAL', 'SESION_PERSONAL'])
  concept?: string;
  @ApiPropertyOptional({ enum: ['NONE', 'D1_30', 'D31_60', 'OVER_60'] })
  @IsOptional()
  @IsIn(['NONE', 'D1_30', 'D31_60', 'OVER_60'])
  overdue?: string;
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;
  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 20;
}
export class PaymentHistoryItemDto {
  @ApiProperty({ format: 'uuid' }) paymentId!: string;
  @ApiProperty({ format: 'uuid', nullable: true }) receiptId!: string | null;
  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Puede ser null para un pago ANULADO sin fecha de pago.',
  })
  paidAt!: Date | null;
  @ApiProperty() concept!: string;
  @ApiProperty() amountUsd!: string;
  @ApiProperty() status!: string;
  @ApiProperty({ nullable: true }) reason!: string | null;
}
export class PaymentHistoryResponseDto {
  @ApiProperty({ type: [PaymentHistoryItemDto] })
  data!: PaymentHistoryItemDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty({ maximum: 50 }) pageSize!: number;
}
