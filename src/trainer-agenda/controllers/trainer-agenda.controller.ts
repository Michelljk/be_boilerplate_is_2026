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
import { UserRole, type User } from '@PrismaClient';
import {
  AgendaQueryDto,
  AgendaResponseDto,
  AttendanceResponseDto,
  RegisterAttendanceDto,
} from '../dto/agenda.dto.js';
import { TrainerAgendaService } from '../services/trainer-agenda.service.js';

@ApiTags('trainer-agenda')
@ApiBearerAuth()
@Roles(UserRole.ENTRENADOR)
@Controller()
export class TrainerAgendaController {
  constructor(private readonly service: TrainerAgendaService) {}

  @Get('trainers/me/agenda')
  @ApiOperation({ summary: 'Consulta de agenda del entrenador' })
  @ApiOkResponse({ type: AgendaResponseDto })
  @ApiBadRequestResponse({ description: 'view o date faltante o inválido.' })
  @ApiUnauthorizedResponse({
    description: 'Sesión ausente, inválida o cuenta inactiva.',
  })
  @ApiForbiddenResponse({
    description: 'Solo los entrenadores pueden consultar esta agenda.',
  })
  async getAgenda(
    @CurrentUser() user: User,
    @Query() query: AgendaQueryDto,
  ): Promise<AgendaResponseDto> {
    return this.service.getAgenda(user, query);
  }

  @Patch('personal-sessions/:id/attendance')
  @ApiOperation({
    summary:
      'Registra una sola vez la asistencia de una sesión personal propia',
  })
  @ApiOkResponse({ type: AttendanceResponseDto })
  @ApiBadRequestResponse({ description: 'UUID o asistencia inválidos.' })
  @ApiNotFoundResponse({
    description: 'La sesión no existe o pertenece a otro entrenador.',
  })
  @ApiConflictResponse({
    description: 'La sesión no inició, está cancelada o ya tiene asistencia.',
  })
  @ApiUnauthorizedResponse({
    description: 'Sesión ausente, inválida o cuenta inactiva.',
  })
  @ApiForbiddenResponse({
    description: 'Solo los entrenadores pueden registrar asistencia.',
  })
  async registerAttendance(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RegisterAttendanceDto,
  ): Promise<AttendanceResponseDto> {
    return this.service.registerAttendance(user, id, dto);
  }
}
