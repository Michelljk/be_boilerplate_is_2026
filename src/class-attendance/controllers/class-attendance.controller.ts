
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';

import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CurrentUser, Roles } from '@Auth/decorators';
import type { User } from '@PrismaClient';

import { ClassAttendanceService } from '../services/class-attendance.service.js';

import { AttendeesQueryDto } from '../dto/attendees-query.dto.js';
import { UpdateAttendanceDto } from '../dto/update-attendance.dto.js';

import {
  AttendanceStatusValue,
  AttendeesResponseDto,
  UpdateAttendanceResponseDto,
  CompleteSessionResponseDto,
} from '../dto/attendees-response.dto.js';

/**
 * H8 — Consulta y registro de asistencia
 * a sesiones grupales.
 */
@ApiTags('Asistencia a sesiones')
@ApiBearerAuth()
@Controller()
@Roles('ENTRENADOR')
export class ClassAttendanceController {
  constructor(
    private readonly service: ClassAttendanceService,
  ) {}

  /**
   * GET /class-sessions/:id/attendees
   * Lista paginada de inscritos.
   */
  @Get('class-sessions/:id/attendees')
  @ApiOperation({
    summary: 'H8. Consultar inscritos de una sesión',
  })
  @ApiOkResponse({
    type: AttendeesResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Identificador o paginación inválida.',
  })
  @ApiUnauthorizedResponse({
    description: 'Usuario no autenticado.',
  })
  @ApiForbiddenResponse({
    description: 'Acceso denegado.',
  })
  @ApiNotFoundResponse({
    description: 'Sesión no encontrada o no asignada.',
  })
  async attendees(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: AttendeesQueryDto,
  ): Promise<AttendeesResponseDto> {
    const result = await this.service.attendees(
      user,
      id,
      query,
    );

    return {
      sessionId: result.session.id,
      className: result.session.className,
      startsAt: result.session.startsAt.toISOString(),
      endsAt: result.session.endsAt.toISOString(),
      capacity: result.session.capacity,
      confirmedCount: result.confirmedCount,
      data: result.data.map((item) => ({
        reservationId: item.reservationId,
        memberNumber: item.memberNumber,
        memberName: item.memberName,
        reservationStatus: item.reservationStatus,
        attendance:
          AttendanceStatusValue[item.attendance],
      })),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }

  /**
   * PATCH /class-reservations/:id/attendance
   * Marca ASISTIO o NO_ASISTIO.
   */
  @Patch('class-reservations/:id/attendance')
  @ApiOperation({
    summary: 'H8. Registrar asistencia de un miembro',
  })
  @ApiOkResponse({
    type: UpdateAttendanceResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de asistencia inválidos.',
  })
  @ApiUnauthorizedResponse({
    description: 'Usuario no autenticado.',
  })
  @ApiForbiddenResponse({
    description: 'Acceso denegado.',
  })
  @ApiNotFoundResponse({
    description: 'Reserva no encontrada o no asignada.',
  })
  @ApiConflictResponse({
    description:
      'La reserva o sesión no admite cambios de asistencia.',
  })
  async updateAttendance(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAttendanceDto,
  ): Promise<UpdateAttendanceResponseDto> {
    const result = await this.service.updateAttendance(
      user,
      id,
      dto,
    );

    return {
      reservationId: result.reservationId,
      attendance:
        AttendanceStatusValue[result.attendance],
      updatedAt: result.updatedAt.toISOString(),
    };
  }

  /**
   * PATCH /class-sessions/:id/complete
   * Cierra la lista de asistencia.
   */
  @Patch('class-sessions/:id/complete')
  @ApiOperation({
    summary: 'H8. Completar sesión grupal',
  })
  @ApiOkResponse({
    type: CompleteSessionResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Usuario no autenticado.',
  })
  @ApiForbiddenResponse({
    description: 'Acceso denegado.',
  })
  @ApiNotFoundResponse({
    description: 'Sesión no encontrada o no asignada.',
  })
  @ApiConflictResponse({
    description:
      'La sesión todavía no puede completarse.',
  })
  async completeSession(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<CompleteSessionResponseDto> {
    const result = await this.service.completeSession(
      user,
      id,
    );

    return {
      id: result.id,
      status: result.status,
      completedAt: result.completedAt.toISOString(),
      attendedCount: result.attendedCount,
      absentCount: result.absentCount,
    };
  }
}
