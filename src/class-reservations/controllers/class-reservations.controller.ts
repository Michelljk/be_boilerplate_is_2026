import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { ParseUUIDPipe } from '@nestjs/common';
import type { User } from '@PrismaClient';
import {
  CancelClassReservationResponseDto,
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

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'H6. Cancelar reserva propia' })
  @ApiOkResponse({ type: CancelClassReservationResponseDto })
  @ApiBadRequestResponse({ description: 'ID inválido.' })
  @ApiNotFoundResponse({
    description: 'La reserva no existe o no pertenece al miembro.',
  })
  @ApiConflictResponse({ description: 'Fuera de plazo o estado no permitido.' })
  async cancel(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<CancelClassReservationResponseDto> {
    return this.service.cancel(user, id);
  }
}
