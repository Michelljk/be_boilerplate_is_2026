import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HOUR_PATTERN = /^(?:0[6-9]|1[0-9]|20):00$/;

export class CreateTrainerSlotDto {
  @ApiProperty({
    description: 'Fecha civil del espacio en America/El_Salvador.',
    example: '2026-11-20',
    format: 'date',
  })
  @IsString()
  @Matches(CALENDAR_DATE_PATTERN, {
    message: 'date debe tener formato YYYY-MM-DD.',
  })
  date!: string;

  @ApiProperty({
    description: 'Hora local en punto, entre 06:00 y 20:00.',
    example: '08:00',
    pattern: '^(?:0[6-9]|1[0-9]|20):00$',
  })
  @IsString()
  @Matches(HOUR_PATTERN, {
    message: 'startTime debe estar entre 06:00 y 20:00, con minutos 00.',
  })
  startTime!: string;
}

export class UpdateTrainerSlotDto {
  @ApiProperty({
    description: 'Nueva fecha civil del espacio en America/El_Salvador.',
    example: '2026-11-20',
    format: 'date',
  })
  @IsString()
  @Matches(CALENDAR_DATE_PATTERN, {
    message: 'date debe tener formato YYYY-MM-DD.',
  })
  date!: string;

  @ApiProperty({
    description: 'Nueva hora local en punto, entre 06:00 y 20:00.',
    example: '08:00',
    pattern: '^(?:0[6-9]|1[0-9]|20):00$',
  })
  @IsString()
  @Matches(HOUR_PATTERN, {
    message: 'startTime debe estar entre 06:00 y 20:00, con minutos 00.',
  })
  startTime!: string;
}

export class ListTrainerSlotsQueryDto {
  @ApiPropertyOptional({
    description: 'Primer día civil incluido.',
    example: '2026-11-08',
    format: 'date',
  })
  @IsOptional()
  @IsString()
  @Matches(CALENDAR_DATE_PATTERN, {
    message: 'from debe tener formato YYYY-MM-DD.',
  })
  from?: string;

  @ApiPropertyOptional({
    description: 'Último día civil incluido.',
    example: '2026-11-23',
    format: 'date',
  })
  @IsOptional()
  @IsString()
  @Matches(CALENDAR_DATE_PATTERN, {
    message: 'to debe tener formato YYYY-MM-DD.',
  })
  to?: string;
}
