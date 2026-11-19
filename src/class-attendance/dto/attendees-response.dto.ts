
import { ApiProperty } from '@nestjs/swagger';

/**
 * Estados de asistencia que puede mostrar H8.
 */
export enum AttendanceStatusValue {
  PENDIENTE = 'PENDIENTE',
  ASISTIO = 'ASISTIO',
  NO_ASISTIO = 'NO_ASISTIO',
}

/**
 * Información de un miembro inscrito.
 */
export class AttendeeResponseDto {
  @ApiProperty({ format: 'uuid' })
  reservationId!: string;

  @ApiProperty({
    example: '00012345',
  })
  memberNumber!: string;

  @ApiProperty({
    example: 'María López',
  })
  memberName!: string;

  @ApiProperty({
    example: 'CONFIRMADA',
    description: 'Estado de la reserva.',
  })
  reservationStatus!: string;

  @ApiProperty({
    enum: AttendanceStatusValue,
    example: AttendanceStatusValue.PENDIENTE,
  })
  attendance!: AttendanceStatusValue;
}

/**
 * Respuesta paginada de los inscritos de una sesión.
 */
export class AttendeesResponseDto {
  @ApiProperty({ format: 'uuid' })
  sessionId!: string;

  @ApiProperty({
    example: 'Entrenamiento funcional',
  })
  className!: string;

  @ApiProperty({
    format: 'date-time',
  })
  startsAt!: string;

  @ApiProperty({
    format: 'date-time',
  })
  endsAt!: string;

  @ApiProperty({
    example: 20,
  })
  capacity!: number;

  @ApiProperty({
    example: 12,
    description: 'Número de reservas confirmadas.',
  })
  confirmedCount!: number;

  @ApiProperty({
    type: [AttendeeResponseDto],
  })
  data!: AttendeeResponseDto[];

  @ApiProperty({
    example: 12,
    description: 'Total de inscritos de la consulta.',
  })
  total!: number;

  @ApiProperty({
    example: 1,
  })
  page!: number;

  @ApiProperty({
    example: 10,
  })
  pageSize!: number;
}

/**
 * Resultado de actualizar la asistencia de una reserva.
 */
export class UpdateAttendanceResponseDto {
  @ApiProperty({ format: 'uuid' })
  reservationId!: string;

  @ApiProperty({
    enum: AttendanceStatusValue,
    example: AttendanceStatusValue.ASISTIO,
  })
  attendance!: AttendanceStatusValue;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

/**
 * Resultado del cierre de una sesión.
 */
export class CompleteSessionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    example: 'COMPLETADA',
  })
  status!: 'COMPLETADA';

  @ApiProperty({ format: 'date-time' })
  completedAt!: string;

  @ApiProperty({ example: 8 })
  attendedCount!: number;

  @ApiProperty({ example: 4 })
  absentCount!: number;
}
