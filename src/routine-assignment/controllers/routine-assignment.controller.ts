import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '@Auth/decorators';
import type { User } from '@PrismaClient';
import {
  CreateTrainingRoutineDto,
  CreateTrainingRoutineVersionDto,
  TrainingRoutineAssignmentResponseDto,
} from '../dto/index.js';
import { RoutineAssignmentService } from '../services/index.js';

@ApiTags('training-routines')
@ApiBearerAuth()
@Controller('training-routines')
export class RoutineAssignmentController {
  constructor(
    private readonly routineAssignmentService: RoutineAssignmentService,
  ) {}

  @Post()
  @Roles('ENTRENADOR')
  @ApiOperation({ summary: 'Asignación de una rutina a un miembro' })
  @ApiCreatedResponse({
    type: TrainingRoutineAssignmentResponseDto,
    description: 'Rutina asignada.',
  })
  @ApiBadRequestResponse({
    description:
      'Body inválido, fechas inconsistentes o ejercicio fuera del catálogo.',
  })
  @ApiUnauthorizedResponse({
    description: 'Token ausente, inválido o expirado.',
  })
  @ApiForbiddenResponse({ description: 'Acceso denegado.' })
  @ApiNotFoundResponse({ description: 'Miembro no asignado al entrenador.' })
  @ApiConflictResponse({
    description:
      'Membresía no elegible o conflicto de actualización simultánea.',
  })
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateTrainingRoutineDto,
  ): Promise<TrainingRoutineAssignmentResponseDto> {
    const assignment = await this.routineAssignmentService.assign(user, dto);
    return TrainingRoutineAssignmentResponseDto.fromAssignment(assignment);
  }

  @Post('trainers/me/members/:memberId/routines/versions')
  @Roles('ENTRENADOR')
  @ApiOperation({ summary: 'Crear versión optimista de rutina H26' })
  async createVersion(
    @CurrentUser() user: User,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: CreateTrainingRoutineVersionDto,
  ): Promise<TrainingRoutineAssignmentResponseDto> {
    const input = Object.assign(new CreateTrainingRoutineDto(), dto, {
      memberId,
    });
    const assignment = await this.routineAssignmentService.assign(user, input);
    return TrainingRoutineAssignmentResponseDto.fromAssignment(assignment);
  }
}

/** Ruta exacta de integración H26; H22 conserva POST /training-routines. */
@ApiTags('training-routines')
@ApiBearerAuth()
@Controller('trainers/me/members')
export class TrainerRoutineVersionController {
  constructor(
    private readonly routineAssignmentService: RoutineAssignmentService,
  ) {}

  @Post(':memberId/routines/versions')
  @Roles('ENTRENADOR')
  @ApiOperation({ summary: 'Crear versión optimista de rutina H26' })
  @ApiCreatedResponse({ type: TrainingRoutineAssignmentResponseDto })
  @ApiBadRequestResponse({ description: 'Body inválido.' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido.' })
  @ApiForbiddenResponse({ description: 'Acceso denegado.' })
  @ApiNotFoundResponse({ description: 'Miembro no asignado al entrenador.' })
  @ApiConflictResponse({
    description: 'La rutina fue actualizada; vuelve a cargarla',
  })
  async createVersion(
    @CurrentUser() user: User,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: CreateTrainingRoutineVersionDto,
  ): Promise<TrainingRoutineAssignmentResponseDto> {
    const input = Object.assign(new CreateTrainingRoutineDto(), dto, {
      memberId,
    });
    const assignment = await this.routineAssignmentService.assign(user, input);
    return TrainingRoutineAssignmentResponseDto.fromAssignment(assignment);
  }
}
