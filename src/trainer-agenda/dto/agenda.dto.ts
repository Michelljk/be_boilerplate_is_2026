import { ApiProperty } from '@nestjs/swagger';
import {
  IsDefined,
  IsEnum,
  IsString,
  Validate,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
  type ValidationArguments,
} from 'class-validator';
import { isCalendarDate } from '@Common/time';

export enum AgendaView {
  DAY = 'day',
  WEEK = 'week',
}

@ValidatorConstraint({ name: 'calendarDate', async: false })
export class CalendarDateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return isCalendarDate(value);
  }

  defaultMessage(_args: ValidationArguments): string {
    return 'date debe ser una fecha civil válida con formato YYYY-MM-DD.';
  }
}

export class AgendaQueryDto {
  @ApiProperty({
    enum: AgendaView,
    enumName: 'AgendaView',
    example: AgendaView.DAY,
  })
  @IsDefined({ message: 'view es obligatorio.' })
  @IsEnum(AgendaView, { message: 'view debe ser day o week.' })
  view!: AgendaView;

  @ApiProperty({ example: '2026-11-09', format: 'date' })
  @IsDefined({ message: 'date es obligatorio.' })
  @IsString({ message: 'date debe ser una cadena.' })
  @Validate(CalendarDateConstraint)
  date!: string;
}

export enum AttendanceChoice {
  ASISTIO = 'ASISTIO',
  NO_ASISTIO = 'NO_ASISTIO',
}

export class RegisterAttendanceDto {
  @ApiProperty({
    enum: AttendanceChoice,
    enumName: 'AttendanceChoice',
    example: AttendanceChoice.ASISTIO,
  })
  @IsDefined({ message: 'attendance es obligatorio.' })
  @IsEnum(AttendanceChoice, {
    message: 'attendance debe ser ASISTIO o NO_ASISTIO.',
  })
  attendance!: AttendanceChoice;
}

export class AgendaItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  startsAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  endsAt!: Date;

  @ApiProperty({ example: 'MBR-0001' })
  memberNumber!: string;

  @ApiProperty({ example: 'Ana Pérez' })
  memberName!: string;

  @ApiProperty({ enum: ['CONFIRMADA', 'CANCELADA', 'COMPLETADA'] })
  status!: string;

  @ApiProperty({ enum: ['PENDIENTE', 'ASISTIO', 'NO_ASISTIO'], nullable: true })
  attendance!: string | null;
}

export class AgendaResponseDto {
  @ApiProperty({ type: [AgendaItemDto] })
  data!: AgendaItemDto[];
}

export class AttendanceResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ['COMPLETADA'] })
  status!: 'COMPLETADA';

  @ApiProperty({ enum: ['ASISTIO', 'NO_ASISTIO'] })
  attendance!: AttendanceChoice;

  @ApiProperty({ type: String, format: 'date-time' })
  completedAt!: Date;
}
