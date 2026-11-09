import { Body, Controller, Get, Post, Query } from '@nestjs/common';
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
import type { User } from '@PrismaClient';
import {
  ClassReservationPageDto,
  CreateClassReservationDto,
  CreateClassReservationResponseDto,
  ListClassReservationsQueryDto,
} from '../dto/index.js';
import { ClassReservationsService } from '../services/class-reservations.service.js';

@ApiTags('class-reservations')
@ApiBearerAuth()
@Controller('class-reservations')
@Roles('MIEMBRO')
export class ClassReservationsController {
  constructor(private readonly service: ClassReservationsService) {}

  @Post()
  @ApiOperation({ summary: 'Reserva una plaza en una sesión grupal futura' })
  @ApiCreatedResponse({ type: CreateClassReservationResponseDto })
  @ApiBadRequestResponse({
    description: 'Body ausente, UUID inválido o propiedades no permitidas.',
  })
  @ApiUnauthorizedResponse({
    description: 'Falta autenticación o el token no es válido.',
  })
  @ApiForbiddenResponse({
    description: 'El usuario autenticado no tiene rol MIEMBRO.',
  })
  @ApiNotFoundResponse({ description: 'La sesión no existe.' })
  @ApiConflictResponse({
    description:
      'Membresía no elegible, sesión iniciada/cancelada, solapamiento, duplicado o cupo lleno.',
  })
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateClassReservationDto,
  ): Promise<CreateClassReservationResponseDto> {
    return this.service.create(user, dto);
  }

  @Get('me')
  @ApiOperation({
    summary: 'Lista las reservas propias del miembro autenticado',
  })
  @ApiOkResponse({ type: ClassReservationPageDto })
  @ApiBadRequestResponse({
    description: 'Filtro de estado o paginación inválidos.',
  })
  @ApiUnauthorizedResponse({
    description: 'Falta autenticación o el token no es válido.',
  })
  @ApiForbiddenResponse({
    description: 'El usuario autenticado no tiene rol MIEMBRO.',
  })
  async listMine(
    @CurrentUser() user: User,
    @Query() query: ListClassReservationsQueryDto,
  ): Promise<ClassReservationPageDto> {
    return this.service.listMine(user, query);
  }
}
