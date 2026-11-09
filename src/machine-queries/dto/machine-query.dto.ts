import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { MachineStatus } from '../../generated/prisma/client.js';

function trimLocation({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function parseInteger({ value }: TransformFnParams): unknown {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) ? value : Number.NaN;
  }
  if (typeof value !== 'string' || !/^[+-]?\d+$/.test(value)) {
    return Number.NaN;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : Number.NaN;
}

export class MachineQueryDto {
  @ApiPropertyOptional({
    enum: MachineStatus,
    description: 'Estado exacto por el que se filtra.',
    example: MachineStatus.DISPONIBLE,
  })
  @IsOptional()
  @IsEnum(MachineStatus)
  status?: MachineStatus;

  @ApiPropertyOptional({
    minLength: 1,
    maxLength: 100,
    description: 'Ubicación exacta, normalizada con trim.',
    example: 'Sala principal',
  })
  @IsOptional()
  @Transform(trimLocation)
  @IsString()
  @Length(1, 100)
  location?: string;

  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    default: 1,
    description: 'Página, comenzando en 1.',
    example: 1,
  })
  @Transform(parseInteger)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    maximum: 50,
    default: 20,
    description: 'Cantidad máxima de máquinas por página.',
    example: 20,
  })
  @Transform(parseInteger)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 20;
}
