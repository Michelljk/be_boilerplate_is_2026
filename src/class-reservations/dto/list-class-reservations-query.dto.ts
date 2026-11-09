import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ReservationStatus } from '@PrismaClient';

export class ListClassReservationsQueryDto {
  @ApiPropertyOptional({
    enum: ReservationStatus,
    description: 'Filtra por estado de la reserva.',
  })
  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;

  @ApiPropertyOptional({
    default: 1,
    minimum: 1,
    description: 'Página basada en uno.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({
    default: 10,
    minimum: 1,
    maximum: 50,
    description: 'Tamaño de página, de 1 a 50.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 10;
}
