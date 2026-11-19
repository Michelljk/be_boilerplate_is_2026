
import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';

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
import { UserRole } from '@PrismaClient';
import type { User } from '@PrismaClient';

import { TrainerProgressService } from '../services/trainer-progress.service.js';

import { TrainerMemberQueryDto } from '../dto/trainer-member-query.dto.js';

import {
  MemberProgressResponseDto,
  TrainerMembersResponseDto,
} from '../dto/trainer-progress-response.dto.js';

/**
 * H26 — Consultas de progreso para entrenadores.
 */
@ApiTags('Progreso de clientes')
@ApiBearerAuth()
@Controller('trainers/me/members')
@Roles(UserRole.ENTRENADOR)
export class TrainerProgressController {
  constructor(
    private readonly service: TrainerProgressService,
  ) {}

  /**
   * Consulta los miembros asignados.
   */
  @Get()
  @ApiOperation({
    summary: 'H26. Consultar mis miembros asignados',
  })
  @ApiOkResponse({
    type: TrainerMembersResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Búsqueda o paginación inválida.',
  })
  @ApiUnauthorizedResponse({
    description: 'Token ausente o inválido.',
  })
  @ApiForbiddenResponse({
    description: 'Solo entrenadores autorizados.',
  })
  async members(
    @CurrentUser() user: User,
    @Query() query: TrainerMemberQueryDto,
  ): Promise<TrainerMembersResponseDto> {
    const page = await this.service.members(user, query);

    return TrainerMembersResponseDto.fromPage(page);
  }

  /**
   * Consulta el progreso físico de un miembro asignado.
   */
  @Get(':memberId/progress')
  @ApiOperation({
    summary: 'H26. Consultar progreso de un cliente',
  })
  @ApiOkResponse({
    type: MemberProgressResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Identificador de miembro inválido.',
  })
  @ApiUnauthorizedResponse({
    description: 'Token ausente o inválido.',
  })
  @ApiForbiddenResponse({
    description: 'Solo entrenadores autorizados.',
  })
  @ApiNotFoundResponse({
    description:
      'El miembro no existe o no tiene una asignación activa con el entrenador.',
  })
  async memberProgress(
    @CurrentUser() user: User,
    @Param('memberId', new ParseUUIDPipe({ version: '4' }))
    memberId: string,
  ): Promise<MemberProgressResponseDto> {
    const progress = await this.service.memberProgress(
      user,
      memberId,
    );

    return MemberProgressResponseDto.fromView(progress);
  }
}
