
import {
  Controller,
  Get,
  Query,
} from '@nestjs/common';

import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CurrentUser, Roles } from '@Auth/decorators';
import { UserRole } from '@PrismaClient';
import type { User } from '@PrismaClient';

import { EvolutionQueryDto } from '../dto/evolution-query.dto.js';
import { EvolutionResponseDto } from '../dto/evolution-response.dto.js';

import { ProgressEvolutionService } from '../services/progress-evolution.service.js';

/**
 * H25 — Consulta de evolución física.
 */
@ApiTags('Progreso físico')
@ApiBearerAuth()
@Controller('progress-records')
@Roles(UserRole.MIEMBRO)
export class ProgressEvolutionController {
  constructor(
    private readonly service: ProgressEvolutionService,
  ) {}

  @Get('me/evolution')
  @ApiOperation({
    summary: 'H25. Consultar mi evolución física',
    description:
      'Devuelve la evolución del peso corporal, medidas ' +
      'o marcas de ejercicios del miembro autenticado.',
  })
  @ApiOkResponse({
    description: 'Serie de evolución física.',
    type: EvolutionResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Métrica, ejercicio o rango de fechas inválidos.',
  })
  @ApiUnauthorizedResponse({
    description: 'Falta autenticación o el token es inválido.',
  })
  @ApiForbiddenResponse({
    description: 'Solo los miembros pueden consultar su evolución.',
  })
  async evolution(
    @CurrentUser() user: User,
    @Query() query: EvolutionQueryDto,
  ): Promise<EvolutionResponseDto> {
    const result = await this.service.evolution(
      user,
      query,
    );

    return EvolutionResponseDto.fromView(result);
  }
}
