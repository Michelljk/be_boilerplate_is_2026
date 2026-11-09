import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  Validate,
  ValidateNested,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'calendarDate', async: false })
export class CalendarDateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
      return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} debe ser una fecha civil válida con formato YYYY-MM-DD.`;
  }
}

export class CreateRoutineExerciseDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Identificador de un ejercicio activo del catálogo.',
  })
  @IsUUID()
  exerciseId!: string;

  @ApiProperty({
    minimum: 1,
    maximum: 7,
    example: 1,
    description: 'Día de la semana.',
  })
  @IsInt()
  @Min(1)
  @Max(7)
  weekday!: number;

  @ApiProperty({ minimum: 1, maximum: 10, example: 3 })
  @IsInt()
  @Min(1)
  @Max(10)
  sets!: number;

  @ApiProperty({ minimum: 1, maximum: 100, example: 12 })
  @IsInt()
  @Min(1)
  @Max(100)
  reps!: number;

  @ApiProperty({ minimum: 1, maximum: 50, example: 1 })
  @IsInt()
  @Min(1)
  @Max(50)
  position!: number;
}

export class CreateTrainingRoutineDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  memberId!: string;

  @ApiProperty({ minLength: 3, maxLength: 80, example: 'Fuerza tren inferior' })
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  @Matches(/\S/, { message: 'name no puede contener únicamente espacios.' })
  name!: string;

  @ApiProperty({
    minLength: 3,
    maxLength: 250,
    example: 'Mejorar fuerza y estabilidad de piernas.',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(250)
  @Matches(/\S/, { message: 'goal no puede contener únicamente espacios.' })
  goal!: string;

  @ApiProperty({ format: 'date', example: '2026-11-10' })
  @IsString()
  @Validate(CalendarDateConstraint)
  startsOn!: string;

  @ApiProperty({ format: 'date', example: '2026-12-10' })
  @IsString()
  @Validate(CalendarDateConstraint)
  endsOn!: string;

  @ApiProperty({ type: [CreateRoutineExerciseDto], minItems: 1, maxItems: 50 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateRoutineExerciseDto)
  exercises!: CreateRoutineExerciseDto[];
}
