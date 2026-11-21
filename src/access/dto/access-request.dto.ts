import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  Matches,
} from 'class-validator';

const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** H13: búsqueda de recepción por `memberNumber` exacto o por nombre. */
export class MemberSearchQueryDto {
  @ApiProperty({
    description:
      'Texto de 2 a 80 caracteres. Coincide con memberNumber exacto o con el nombre que lo contiene, sin distinguir mayúsculas.',
    example: 'María',
    minLength: 2,
    maxLength: 80,
  })
  @IsString({ message: 'q debe ser texto.' })
  @MinLength(2, { message: 'La búsqueda debe tener al menos 2 caracteres.' })
  @MaxLength(80, { message: 'La búsqueda no puede superar 80 caracteres.' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  q!: string;
}

/** H13 y H14: el cuerpo nunca trae fecha ni hora; las asigna el servidor. */
export class RegisterCheckInDto {
  @ApiProperty({
    description: 'UUID del miembro que ingresa.',
    format: 'uuid',
  })
  @IsUUID('all', { message: 'memberId debe ser un UUID válido.' })
  memberId!: string;

  @ApiPropertyOptional({
    description:
      'Confirmación explícita de recepción para registrar el ingreso con la membresía no vigente (H14).',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'confirmExpired debe ser un booleano.' })
  confirmExpired = false;
}

/** H15: filtros del historial; sin rango se toman los últimos 30 días. */
export class CheckInHistoryQueryDto {
  @ApiPropertyOptional({
    description: 'Primer día civil incluido (YYYY-MM-DD).',
    example: '2026-10-13',
    format: 'date',
  })
  @IsOptional()
  @Matches(CALENDAR_DATE_PATTERN, {
    message: 'from debe tener formato YYYY-MM-DD.',
  })
  from?: string;

  @ApiPropertyOptional({
    description: 'Último día civil incluido (YYYY-MM-DD).',
    example: '2026-11-11',
    format: 'date',
  })
  @IsOptional()
  @Matches(CALENDAR_DATE_PATTERN, {
    message: 'to debe tener formato YYYY-MM-DD.',
  })
  to?: string;

  @ApiPropertyOptional({
    description: 'Número de miembro exacto.',
    example: 'M-0001',
    minLength: 1,
    maxLength: 30,
  })
  @IsOptional()
  @IsString({ message: 'memberNumber debe ser texto.' })
  @MinLength(1, { message: 'memberNumber no puede estar vacío.' })
  @MaxLength(30, {
    message: 'memberNumber no puede superar 30 caracteres.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  memberNumber?: string;

  @ApiPropertyOptional({
    description: 'Página solicitada, iniciando en 1.',
    example: 1,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page debe ser un entero.' })
  @Min(1, { message: 'page debe ser mayor o igual que 1.' })
  page = 1;

  @ApiPropertyOptional({
    description: 'Ingresos por página; H15 fija 20 como máximo.',
    example: 20,
    default: 20,
    minimum: 1,
    maximum: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize debe ser un entero.' })
  @Min(1, { message: 'pageSize debe ser mayor o igual que 1.' })
  @Max(20, { message: 'pageSize no puede superar 20.' })
  pageSize = 20;
}
