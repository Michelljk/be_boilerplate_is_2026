import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
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
import {
  BookedPersonalSessionDto,
  CancelledPersonalSessionDto,
  CreatePersonalSessionDto,
  ListPersonalSessionsQueryDto,
  PersonalSessionListResponseDto,
} from '../dto/index.js';
import { PersonalSessionsService } from '../services/index.js';

@ApiTags('Sesiones personales del miembro (H10 y H11)')
@ApiBearerAuth()
@Roles(UserRole.MIEMBRO)
@Controller('personal-sessions')
export class PersonalSessionsController {
  constructor(private readonly service: PersonalSessionsService) {}

  @Post()
  @ApiOperation({
    summary:
      'H10. Agenda una sesión personal en un espacio LIBRE del entrenador',
  })
  @ApiCreatedResponse({
    description:
      'Sesión CONFIRMADA con su cobro PENDIENTE de 10.00 USD. Un reintento del mismo miembro devuelve la sesión ya creada.',
    type: BookedPersonalSessionDto,
  })
  @ApiBadRequestResponse({
    description:
      'Body ausente, slotId no es un UUID o trae propiedades no permitidas.',
  })
  @ApiUnauthorizedResponse({ description: 'Falta un JWT válido.' })
  @ApiForbiddenResponse({
    description: 'El usuario autenticado no tiene rol MIEMBRO.',
  })
  @ApiNotFoundResponse({ description: 'El espacio indicado no existe.' })
  @ApiConflictResponse({
    description:
      '«Tu membresía no está vigente», «El horario no está disponible» o «Ya tienes una sesión en ese horario».',
  })
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreatePersonalSessionDto,
  ): Promise<BookedPersonalSessionDto> {
    const session = await this.service.create(user, dto);
    return BookedPersonalSessionDto.fromRecord(session);
  }

  @Get('me')
  @ApiOperation({
    summary: 'H10. Lista las sesiones personales del miembro autenticado',
  })
  @ApiOkResponse({ type: PersonalSessionListResponseDto })
  @ApiBadRequestResponse({
    description:
      'Estado no reconocido o paginación fuera de rango (page ≥ 1, 1 ≤ pageSize ≤ 50).',
  })
  @ApiUnauthorizedResponse({ description: 'Falta un JWT válido.' })
  @ApiForbiddenResponse({
    description: 'El usuario autenticado no tiene rol MIEMBRO.',
  })
  async mine(
    @CurrentUser() user: User,
    @Query() query: ListPersonalSessionsQueryDto,
  ): Promise<PersonalSessionListResponseDto> {
    const page = await this.service.mine(user, query);
    return PersonalSessionListResponseDto.fromPage(
      page,
      query.page,
      query.pageSize,
    );
  }

  @Patch(':id/cancel')
  @ApiOperation({
    summary: 'H11. Cancela una sesión propia hasta 12 horas antes',
  })
  @ApiOkResponse({ type: CancelledPersonalSessionDto })
  @ApiBadRequestResponse({ description: 'El id de la sesión no es un UUID.' })
  @ApiUnauthorizedResponse({ description: 'Falta un JWT válido.' })
  @ApiForbiddenResponse({
    description: 'El usuario autenticado no tiene rol MIEMBRO.',
  })
  @ApiNotFoundResponse({ description: 'Sesión inexistente o de otro miembro.' })
  @ApiConflictResponse({
    description:
      '«La sesión solo puede cancelarse hasta 12 horas antes» o «La sesión ya no puede cancelarse».',
  })
  async cancel(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<CancelledPersonalSessionDto> {
    const cancelled = await this.service.cancel(user, id);
    return CancelledPersonalSessionDto.fromRecord(cancelled);
  }
}
