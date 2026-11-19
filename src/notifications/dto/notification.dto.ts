import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { NotificationModule, NotificationStatus } from '@PrismaClient';
import type { NotificationRow } from '../repositories/index.js';

const MODULES = Object.values(NotificationModule) as string[];

/** Filtros de `GET /api/notifications` (H34: módulo y «sólo no leídas»). */
export class NotificationQueryDto {
  @ApiPropertyOptional({
    description: 'Módulo de origen del aviso; vacío trae todos.',
    enum: MODULES,
  })
  @IsOptional()
  @IsIn(MODULES, { message: 'module no pertenece al enum de módulos.' })
  module?: NotificationModule;

  @ApiPropertyOptional({
    description:
      'Verdadero muestra sólo las no leídas; falso u omitido muestra todas.',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return value;
  })
  @IsBoolean({ message: 'unread debe ser true o false.' })
  unread?: boolean;

  @ApiPropertyOptional({
    description: 'Página solicitada, empezando en 1.',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? 1 : Number(value)))
  @Type(() => Number)
  @IsInt({ message: 'page debe ser un entero.' })
  @Min(1, { message: 'page debe ser mayor o igual que 1.' })
  page = 1;
  @ApiPropertyOptional({
    description: 'Notificaciones por página; la bandeja usa 20 por defecto.',
    default: 20,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value == null ? 20 : Number(value),
  )
  @Type(() => Number)
  @IsInt({ message: 'pageSize debe ser un entero.' })
  @Min(1, { message: 'pageSize debe ser mayor o igual que 1.' })
  @Max(50, { message: 'pageSize no puede superar 50.' })
  pageSize = 20;
}

/** Fila de la bandeja, con el módulo de origen y la fecha de creación. */
export class NotificationResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: MODULES }) module!: string;
  @ApiProperty({ example: 'Tu membresía vence pronto' }) title!: string;
  @ApiProperty() message!: string;
  @ApiProperty({ nullable: true, format: 'uuid' })
  referenceId!: string | null;
  @ApiProperty({ enum: Object.values(NotificationStatus) }) status!: string;
  @ApiProperty({ example: '2026-11-11T06:00:00.000Z' }) createdAt!: string;

  static fromRow(row: NotificationRow): NotificationResponseDto {
    const dto = new NotificationResponseDto();
    dto.id = row.id;
    dto.module = row.module;
    dto.title = row.title;
    dto.message = row.message;
    dto.referenceId = row.referenceId;
    dto.status = row.status;
    dto.createdAt = row.createdAt.toISOString();
    return dto;
  }
}

/** Respuesta paginada de la bandeja. */
export class NotificationListResponseDto {
  @ApiProperty({ type: [NotificationResponseDto] })
  items!: NotificationResponseDto[];
  @ApiProperty({ example: 37 }) total!: number;
  @ApiProperty({ example: 1 }) page!: number;
  @ApiProperty({ example: 20 }) pageSize!: number;

  static fromPage(page: {
    items: NotificationRow[];
    total: number;
    page: number;
    pageSize: number;
  }): NotificationListResponseDto {
    const dto = new NotificationListResponseDto();
    dto.items = page.items.map((row) => NotificationResponseDto.fromRow(row));
    dto.total = page.total;
    dto.page = page.page;
    dto.pageSize = page.pageSize;
    return dto;
  }
}

/** Confirmación de `PATCH /api/notifications/:id/read`. */
export class MarkReadResponseDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty({
    description:
      'Verdadero cuando la notificación ya estaba leída (H34 criterio 6).',
    example: false,
  })
  alreadyRead!: boolean;
}

/** Contador que consume el ícono de la cabecera. */
export class UnreadCountResponseDto {
  @ApiProperty({ example: 3 }) count!: number;
}
