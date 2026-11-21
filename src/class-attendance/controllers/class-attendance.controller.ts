import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '@Auth/decorators';
import { UserRole, type User } from '@PrismaClient';
import {
  AttendeesQueryDto,
  AttendanceUpdatedResponseDto,
  ClassAttendeesResponseDto,
  ClassSessionCompletedResponseDto,
  UpdateAttendanceDto,
} from '../dto/class-attendance.dto.js';
import { ClassAttendanceService } from '../services/class-attendance.service.js';

@ApiTags('class-attendance')
@ApiBearerAuth()
@Roles(UserRole.ENTRENADOR)
@Controller()
export class ClassAttendanceController {
  constructor(private readonly service: ClassAttendanceService) {}

  @Get('class-sessions/:id/attendees')
  @ApiOperation({
    summary: 'H8. Consultar asistentes de una sesión asignada al entrenador',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, example: 10 })
  @ApiOkResponse({ type: ClassAttendeesResponseDto })
  @ApiBadRequestResponse({ description: 'UUID o paginación inválida.' })
  @ApiUnauthorizedResponse({ description: 'Falta un JWT válido.' })
  @ApiNotFoundResponse({
    description: 'La sesión no existe o no pertenece al entrenador.',
  })
  async attendees(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query() query: AttendeesQueryDto,
  ): Promise<ClassAttendeesResponseDto> {
    const result = await this.service.attendees(user, id, query);
    return Object.assign(new ClassAttendeesResponseDto(), {
      ...result,
      startsAt: result.startsAt.toISOString(),
      endsAt: result.endsAt.toISOString(),
    });
  }

  @Patch('class-reservations/:id/attendance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'H8. Registrar asistencia de una reserva confirmada',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AttendanceUpdatedResponseDto })
  @ApiBadRequestResponse({ description: 'UUID o asistencia inválida.' })
  @ApiUnauthorizedResponse({ description: 'Falta un JWT válido.' })
  @ApiNotFoundResponse({
    description: 'La reserva no existe o su sesión no pertenece al entrenador.',
  })
  @ApiConflictResponse({
    description: 'La sesión no está en curso o la reserva no está confirmada.',
  })
  async updateAttendance(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateAttendanceDto,
  ): Promise<AttendanceUpdatedResponseDto> {
    const result = await this.service.updateAttendance(user, id, dto);
    return Object.assign(new AttendanceUpdatedResponseDto(), {
      ...result,
      updatedAt: result.updatedAt.toISOString(),
    });
  }

  @Patch('class-sessions/:id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'H8. Cerrar lista y completar la sesión al finalizar su horario',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ClassSessionCompletedResponseDto })
  @ApiBadRequestResponse({ description: 'UUID inválido.' })
  @ApiUnauthorizedResponse({ description: 'Falta un JWT válido.' })
  @ApiNotFoundResponse({
    description: 'La sesión no existe o no pertenece al entrenador.',
  })
  @ApiConflictResponse({
    description: 'La sesión todavía no puede cerrarse o ya no admite cambios.',
  })
  async complete(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ): Promise<ClassSessionCompletedResponseDto> {
    const result = await this.service.complete(user, id);
    return Object.assign(new ClassSessionCompletedResponseDto(), {
      ...result,
      completedAt: result.completedAt.toISOString(),
    });
  }
}
