
import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';

import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  OmitType,
} from '@nestjs/swagger';

import { CurrentUser, Roles } from '@Auth/decorators';
import type { User } from '@PrismaClient';

import {
  CreateTrainingRoutineDto,
  TrainingRoutineAssignmentResponseDto,
} from '../dto/index.js';

import { RoutineAssignmentService } from '../services/index.js';

/**
 * H26: utiliza los campos de creación
 * de rutina, excepto memberId.
 *
 * El identificador del miembro se recibe
 * exclusivamente desde la URL.
 */
class CreateRoutineVersionDto extends OmitType(
  CreateTrainingRoutineDto,
  ['memberId'] as const,
) {}

/**
 * H26 — Versionado de rutinas de clientes.
 */
@ApiTags('Rutinas de clientes')
@ApiBearerAuth()
@Controller('trainers/me/members')
@Roles('ENTRENADOR')
export class TrainerRoutineVersionController {
  constructor(
    private readonly service: RoutineAssignmentService,
  ) {}

  @Post(':memberId/routines/versions')
  @ApiOperation({
    summary: 'H26. Crear nueva versión de rutina',
  })
  @ApiCreatedResponse({
    type: TrainingRoutineAssignmentResponseDto,
    description: 'Nueva versión de rutina creada.',
  })
  @ApiBadRequestResponse({
    description: 'Datos de rutina inválidos.',
  })
  @ApiForbiddenResponse({
    description: 'Acceso denegado.',
  })
  @ApiNotFoundResponse({
    description:
      'El miembro no tiene una asignación activa con el entrenador.',
  })
  @ApiConflictResponse({
    description:
      'La rutina fue actualizada; vuelve a cargarla.',
  })
  async createVersion(
    @CurrentUser() user: User,
    @Param('memberId', new ParseUUIDPipe())
    memberId: string,
    @Body() dto: CreateRoutineVersionDto,
  ): Promise<TrainingRoutineAssignmentResponseDto> {
    const input = Object.assign(
      new CreateTrainingRoutineDto(),
      dto,
      { memberId },
    );

    const result = await this.service.assign(
      user,
      input,
    );

    return TrainingRoutineAssignmentResponseDto.fromAssignment(
      result,
    );
  }
}
