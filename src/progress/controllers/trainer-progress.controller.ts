import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '@Auth/decorators';
import { UserRole, type User } from '@PrismaClient';
import { TrainerProgressService } from '../services/index.js';
import {
  MemberProgressQueryDto,
  TrainerMemberQueryDto,
} from '../dto/progress-query.dto.js';
import {
  MemberProgressResponseDto,
  TrainerMembersResponseDto,
} from '../dto/trainer-progress-response.dto.js';

/** Directorio de clientes y ficha de progreso que consume el entrenador (H26). */
@ApiTags('Progreso de clientes')
@ApiBearerAuth()
@Controller('trainers/me/members')
@Roles(UserRole.ENTRENADOR)
export class TrainerProgressController {
  constructor(private readonly service: TrainerProgressService) {}

  @Get()
  @ApiOkResponse({ type: TrainerMembersResponseDto })
  @ApiBadRequestResponse({ description: 'Búsqueda o paginación inválidas.' })
  @ApiUnauthorizedResponse({ description: 'Sin autenticación.' })
  @ApiForbiddenResponse({ description: 'Rol distinto de ENTRENADOR.' })
  members(
    @CurrentUser() user: User,
    @Query() query: TrainerMemberQueryDto,
  ): Promise<TrainerMembersResponseDto> {
    return this.service
      .members(user, query)
      .then((page) => TrainerMembersResponseDto.fromPage(page));
  }

  @Get(':memberId/progress')
  @ApiOkResponse({ type: MemberProgressResponseDto })
  @ApiBadRequestResponse({ description: 'Identificador o rango inválidos.' })
  @ApiNotFoundResponse({
    description: 'El cliente no está asignado al entrenador.',
  })
  @ApiForbiddenResponse({ description: 'Rol distinto de ENTRENADOR.' })
  progress(
    @CurrentUser() user: User,
    @Param('memberId', new ParseUUIDPipe({ version: '4' })) memberId: string,
    @Query() query: MemberProgressQueryDto,
  ): Promise<MemberProgressResponseDto> {
    return this.service
      .memberProgress(user, memberId, query)
      .then((view) => MemberProgressResponseDto.fromView(view));
  }
}
