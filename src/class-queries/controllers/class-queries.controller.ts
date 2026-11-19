import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '@Auth/decorators';
import { UserRole } from '@PrismaClient';
import {
  ClassSessionsQueryDto,
  ClassSessionsResponseDto,
} from '../dto/index.js';
import { ClassQueriesService } from '../services/index.js';

@ApiTags('class-sessions')
@Controller('class-sessions')
export class ClassQueriesController {
  constructor(private readonly classQueriesService: ClassQueriesService) {}

  @Get()
  @Roles(UserRole.MIEMBRO)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'H4. Consulta de sesiones grupales disponibles de la semana',
  })
  @ApiOkResponse({ type: ClassSessionsResponseDto })
  @ApiBadRequestResponse({
    description: 'Los filtros o el rango de siete días no son válidos.',
  })
  @ApiUnauthorizedResponse({ description: 'Falta un JWT válido.' })
  @ApiForbiddenResponse({
    description: 'Solo los miembros pueden consultar sesiones.',
  })
  async find(
    @Query() query: ClassSessionsQueryDto,
  ): Promise<ClassSessionsResponseDto> {
    const page = await this.classQueriesService.findSessions(query);
    return ClassSessionsResponseDto.fromPage(page);
  }
}
