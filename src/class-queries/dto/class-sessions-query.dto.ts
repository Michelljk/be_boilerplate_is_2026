import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDefined,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { isCalendarDate } from '@Common/time';

@ValidatorConstraint({ name: 'isCalendarDate', async: false })
class CalendarDateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return isCalendarDate(value);
  }

  defaultMessage(args?: ValidationArguments): string {
    return `${args?.property ?? 'La fecha'} debe tener formato YYYY-MM-DD y ser una fecha civil válida.`;
  }
}

export class ClassSessionsQueryDto {
  @ApiProperty({
    description: 'Primer día civil incluido en la ventana de siete días.',
    example: '2026-11-09',
    format: 'date',
  })
  @IsDefined({ message: 'from es obligatorio.' })
  @IsString({ message: 'from debe ser una fecha YYYY-MM-DD.' })
  @Validate(CalendarDateConstraint)
  from!: string;

  @ApiProperty({
    description: 'Último día civil incluido; debe ser from + 6 días.',
    example: '2026-11-15',
    format: 'date',
  })
  @IsDefined({ message: 'to es obligatorio.' })
  @IsString({ message: 'to debe ser una fecha YYYY-MM-DD.' })
  @Validate(CalendarDateConstraint)
  to!: string;

  @ApiPropertyOptional({
    description:
      'Filtra por nombre de clase, contiene sin distinguir mayúsculas.',
    example: 'spinning',
    maxLength: 80,
  })
  @IsOptional()
  @IsString({ message: 'name debe ser texto.' })
  @MaxLength(80, { message: 'name no puede superar 80 caracteres.' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name?: string;

  @ApiPropertyOptional({
    description: 'Identificador UUID de la sala.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('all', { message: 'roomId debe ser un UUID válido.' })
  roomId?: string;

  @ApiPropertyOptional({
    description: 'Identificador UUID del entrenador.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('all', { message: 'trainerId debe ser un UUID válido.' })
  trainerId?: string;

  @ApiPropertyOptional({
    description: 'Página (inicia en 1).',
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
    description: 'Cantidad de sesiones por página.',
    example: 10,
    default: 10,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize debe ser un entero.' })
  @Min(1, { message: 'pageSize debe ser mayor o igual que 1.' })
  @Max(50, { message: 'pageSize no puede superar 50.' })
  pageSize = 10;
}
