import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  AttendanceStatus,
  ReservationStatus,
  SessionStatus,
} from '@PrismaClient';

export class AttendeesQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 10;
}

export class UpdateAttendanceDto {
  @ApiProperty({
    enum: [AttendanceStatus.ASISTIO, AttendanceStatus.NO_ASISTIO],
  })
  @IsIn([AttendanceStatus.ASISTIO, AttendanceStatus.NO_ASISTIO])
  attendance!:
    typeof AttendanceStatus.ASISTIO | typeof AttendanceStatus.NO_ASISTIO;
}

export class ClassAttendeeDto {
  @ApiProperty({ format: 'uuid' })
  reservationId!: string;

  @ApiProperty()
  memberNumber!: string;

  @ApiProperty()
  memberName!: string;

  @ApiProperty({ enum: ReservationStatus })
  reservationStatus!: ReservationStatus;

  @ApiProperty({ enum: AttendanceStatus })
  attendance!: AttendanceStatus;
}

export class ClassAttendeesResponseDto {
  @ApiProperty({ format: 'uuid' })
  sessionId!: string;

  @ApiProperty()
  className!: string;

  @ApiProperty({ format: 'date-time' })
  startsAt!: string;

  @ApiProperty({ format: 'date-time' })
  endsAt!: string;

  @ApiProperty()
  capacity!: number;

  @ApiProperty()
  confirmedCount!: number;

  @ApiProperty({ type: [ClassAttendeeDto] })
  data!: ClassAttendeeDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}

export class AttendanceUpdatedResponseDto {
  @ApiProperty({ format: 'uuid' })
  reservationId!: string;

  @ApiProperty({
    enum: [AttendanceStatus.ASISTIO, AttendanceStatus.NO_ASISTIO],
  })
  attendance!:
    typeof AttendanceStatus.ASISTIO | typeof AttendanceStatus.NO_ASISTIO;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class ClassSessionCompletedResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: [SessionStatus.COMPLETADA] })
  status!: typeof SessionStatus.COMPLETADA;

  @ApiProperty({ format: 'date-time' })
  completedAt!: string;

  @ApiProperty()
  attendedCount!: number;

  @ApiProperty()
  absentCount!: number;
}
