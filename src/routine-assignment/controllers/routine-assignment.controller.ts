import { Body, Controller, Post } from '@nestjs/common';
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
}
