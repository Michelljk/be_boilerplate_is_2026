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
import { CurrentUser, Roles } from '../../auth/decorators/index.js';
import { UserRole, type User } from '../../generated/prisma/client.js';
import { MachineListResponseDto, MachineQueryDto } from '../dto/index.js';
import { MachineQueriesService } from '../services/index.js';

@ApiTags('machines')
@ApiBearerAuth()
@Controller('machines')
export class MachineQueriesController {
  constructor(private readonly machineQueriesService: MachineQueriesService) {}

  @Get()
  @Roles(UserRole.MIEMBRO, UserRole.RECEPCION_ADMIN)
  @ApiOperation({
    summary: 'Consulta la disponibilidad vigente de las máquinas',
    description:
      'Lista máquinas filtrables por estado y ubicación con paginación estable.',
  })
  @ApiOkResponse({
    type: MachineListResponseDto,
    description: 'Listado de máquinas consultado correctamente.',
  })
  @ApiBadRequestResponse({ description: 'Filtro o paginación inválidos.' })
  @ApiUnauthorizedResponse({ description: 'No autenticado.' })
  @ApiForbiddenResponse({
    description: 'Acceso denegado para el rol autenticado.',
  })
  async list(
    @CurrentUser() _user: User,
    @Query() query: MachineQueryDto,
  ): Promise<MachineListResponseDto> {
    return this.machineQueriesService.list(query);
  }
}
