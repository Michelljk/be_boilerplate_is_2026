import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '@Auth/decorators';
import { UserRole, type User } from '@PrismaClient';
import { TrainerSlotListResponseDto } from '../dto/index.js';
import { PersonalSessionsService } from '../services/index.js';

/**
 * Catálogo de horarios que consume el miembro al agendar (H10).
 * El listado de entrenadores vive una sola vez en `class-administration`.
 */
@ApiTags('Sesiones personales del miembro (H10 y H11)')
@ApiBearerAuth()
@Roles(UserRole.MIEMBRO)
@Controller('trainers')
export class TrainerAvailabilityController {
  constructor(private readonly service: PersonalSessionsService) {}

  @Get(':trainerId/slots')
  @ApiOperation({
    summary: 'H10. Espacios LIBRE del entrenador en los próximos 15 días',
    description:
      'Devuelve sólo espacios LIBRE ordenados por fecha y hora ascendente; vacío cuando el entrenador no tiene horarios.',
  })
  @ApiOkResponse({ type: TrainerSlotListResponseDto })
  @ApiBadRequestResponse({ description: 'trainerId no es un UUID válido.' })
  @ApiUnauthorizedResponse({ description: 'Falta un JWT válido.' })
  @ApiForbiddenResponse({
    description: 'El usuario autenticado no tiene rol MIEMBRO.',
  })
  @ApiNotFoundResponse({
    description: 'El entrenador no existe o está inactivo.',
  })
  async slots(
    @CurrentUser() user: User,
    @Param('trainerId', new ParseUUIDPipe()) trainerId: string,
  ): Promise<TrainerSlotListResponseDto> {
    const slots = await this.service.freeSlots(user, trainerId);
    return TrainerSlotListResponseDto.fromRecords(slots);
  }
}
