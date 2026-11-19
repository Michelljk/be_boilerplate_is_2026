
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum AttendanceValue {
  ASISTIO = 'ASISTIO',
  NO_ASISTIO = 'NO_ASISTIO',
}

/**
 * H8 — Registro de asistencia a sesiones grupales.
 *
 * Solo se permiten dos valores:
 * ASISTIO o NO_ASISTIO.
 */
export class UpdateAttendanceDto {
  @ApiProperty({
    enum: AttendanceValue,
    example: AttendanceValue.ASISTIO,
    description:
      'Estado de asistencia que registra el entrenador.',
  })
  @IsEnum(AttendanceValue, {
    message:
      'attendance debe ser ASISTIO o NO_ASISTIO.',
  })
  attendance!: AttendanceValue;
}
