import {
  BadRequestException,
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
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '@Auth/decorators';
import type { User } from '@PrismaClient';
import {
  CreateTrainingRoutineVersionDto,
  TrainingRoutineAssignmentResponseDto,
} from '../dto/index.js';
import { RoutineAssignmentService } from '../services/index.js';

/**
 * H26 — Versionado de rutinas de clientes.
 * El identificador del miembro se recibe exclusivamente desde la URL.
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
    @Body() dto: CreateTrainingRoutineVersionDto,
  ): Promise<TrainingRoutineAssignmentResponseDto> {
    if (
      !Number.isSafeInteger(dto.expectedCurrentVersion) ||
      dto.expectedCurrentVersion < 1
    ) {
      throw new BadRequestException(
        'expectedCurrentVersion es obligatorio y debe ser un entero positivo.',
      );
    }

    const result = await this.service.assign(user, {
      ...dto,
      memberId,
    });

    return TrainingRoutineAssignmentResponseDto.fromAssignment(result);
  }
}