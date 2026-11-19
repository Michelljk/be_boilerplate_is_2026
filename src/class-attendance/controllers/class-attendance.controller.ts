
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
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '@Auth/decorators';
import { UserRole, type User } from '@PrismaClient';

import { UpdateAttendanceDto } from '../dto/update-attendance.dto.js';
import { ClassAttendanceService } from '../services/class-attendance.service.js';

@ApiTags('H8 - Registro de asistencia')
@ApiBearerAuth()
@Roles(UserRole.ENTRENADOR)
@Controller()
export class ClassAttendanceController {
  constructor(
    private readonly service: ClassAttendanceService,
  ) {}

  /**
   * Consultar los inscritos de una sesión grupal.
   */
  @Get('class-sessions/:sessionId/attendees')
  @ApiOperation({
    summary: 'H8. Consultar inscritos de una sesión grupal',
  })
  async findAttendees(
    @CurrentUser() user: User,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.findAttendees(
      user,
      sessionId,
      page === undefined ? 1 : Number(page),
      pageSize === undefined ? 10 : Number(pageSize),
    );
  }

  /**
   * Registrar asistencia o inasistencia.
   */
  @Patch('class-reservations/:reservationId/attendance')
  @ApiOperation({
    summary: 'H8. Registrar asistencia de un miembro',
  })
  async updateAttendance(
    @CurrentUser() user: User,
    @Param('reservationId', new ParseUUIDPipe())
    reservationId: string,
    @Body() dto: UpdateAttendanceDto,
  ) {
    return this.service.updateAttendance(
      user,
      reservationId,
      dto.attendance,
    );
  }

  /**
   * Completar la sesión y cerrar el registro.
   */
  @Patch('class-sessions/:sessionId/complete')
  @ApiOperation({
    summary: 'H8. Completar una sesión grupal',
  })
  async completeSession(
    @CurrentUser() user: User,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
  ) {
    return this.service.completeSession(user, sessionId);
  }
}
