import { Body, Controller, Get, Post, Query, UseFilters } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '@Auth/decorators';
import { UserRole, type User } from '@PrismaClient';
import { AccessService } from '../services/access.service.js';
import { MembershipAlertFilter } from './membership-alert.filter.js';
import { MemberSearchService } from '../services/member-search.service.js';
import { CheckInHistoryService } from '../services/check-in-history.service.js';
import {
  CheckInHistoryQueryDto,
  MemberSearchQueryDto,
  RegisterCheckInDto,
} from '../dto/access-request.dto.js';
import {
  CheckInCreatedDto,
  CheckInHistoryResponseDto,
  MemberSearchResponseDto,
} from '../dto/access-response.dto.js';

@ApiTags('access')
@ApiBearerAuth()
@Controller('access')
@Roles(UserRole.RECEPCION_ADMIN)
export class AccessController {
  constructor(
    private readonly access: AccessService,
    private readonly members: MemberSearchService,
    private readonly history: CheckInHistoryService,
  ) {}

  @Get('members')
  @ApiOperation({ summary: 'H13/H14. Buscar miembros y estado de membresía' })
  @ApiOkResponse({ type: MemberSearchResponseDto })
  @ApiBadRequestResponse({ description: 'Texto de búsqueda inválido.' })
  @ApiUnauthorizedResponse({ description: 'Falta un JWT válido.' })
  @ApiForbiddenResponse({ description: 'Solo recepción y administración.' })
  async search(
    @Query() query: MemberSearchQueryDto,
  ): Promise<MemberSearchResponseDto> {
    return MemberSearchResponseDto.fromSummaries(
      await this.members.search(query.q),
    );
  }

  @Post('check-ins')
  @UseFilters(MembershipAlertFilter)
  @ApiOperation({ summary: 'H13/H14. Registrar el ingreso de un miembro' })
  @ApiCreatedResponse({ type: CheckInCreatedDto })
  @ApiBadRequestResponse({
    description: 'El UUID o la solicitud son inválidos.',
  })
  @ApiUnauthorizedResponse({ description: 'Falta un JWT válido.' })
  @ApiForbiddenResponse({ description: 'Solo recepción y administración.' })
  @ApiNotFoundResponse({ description: 'No se encontró al miembro.' })
  @ApiConflictResponse({
    description:
      'Ingreso duplicado o confirmación de membresía vencida requerida.',
  })
  async register(
    @Body() input: RegisterCheckInDto,
    @CurrentUser() actor: User,
  ): Promise<CheckInCreatedDto> {
    return CheckInCreatedDto.fromSnapshot(
      await this.access.register(input, actor),
    );
  }

  @Get('check-ins')
  @ApiOperation({ summary: 'H15. Consultar historial paginado de ingresos' })
  @ApiOkResponse({ type: CheckInHistoryResponseDto })
  @ApiBadRequestResponse({ description: 'Fechas o paginación inválidas.' })
  @ApiUnauthorizedResponse({ description: 'Falta un JWT válido.' })
  @ApiForbiddenResponse({ description: 'Solo recepción y administración.' })
  async list(
    @Query() query: CheckInHistoryQueryDto,
  ): Promise<CheckInHistoryResponseDto> {
    return CheckInHistoryResponseDto.fromPage(
      await this.history.history(query),
    );
  }
}
