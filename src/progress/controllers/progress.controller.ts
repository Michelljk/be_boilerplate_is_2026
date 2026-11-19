
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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

import { ProgressService } from '../services/progress.service.js';

import { ProgressRecordInputDto } from '../dto/progress-record-input.dto.js';

import { ProgressHistoryQueryDto } from '../dto/progress-history-query.dto.js';

import {
  ProgressHistoryResponseDto,
  ProgressRecordResponseDto,
} from '../dto/progress-record-response.dto.js';

/**
 * H24: registro y consulta de progreso físico.
 */
@ApiTags('Progreso físico')
@ApiBearerAuth()
@Controller('progress-records')
@Roles(UserRole.MIEMBRO)
export class ProgressController {
  constructor(
    private readonly service: ProgressService,
  ) {}

  /**
   * Registrar progreso físico.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'H24. Registrar progreso físico',
  })
  @ApiCreatedResponse({
    type: ProgressRecordResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Fecha, medidas o marcas inválidas.',
  })
  @ApiUnauthorizedResponse({
    description: 'Sin autenticación.',
  })
  @ApiForbiddenResponse({
    description: 'Rol distinto de MIEMBRO.',
  })
  @ApiConflictResponse({
    description: 'Ya existe un registro para ese día.',
  })
  async create(
    @CurrentUser() user: User,
    @Body() input: ProgressRecordInputDto,
  ): Promise<ProgressRecordResponseDto> {
    const view = await this.service.create(
      user,
      input,
    );

    return ProgressRecordResponseDto.fromView(view);
  }

  /**
   * Consultar historial propio.
   */
  @Get('me')
  @ApiOperation({
    summary: 'H24. Consultar historial de progreso',
  })
  @ApiOkResponse({
    type: ProgressHistoryResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Sin autenticación.',
  })
  @ApiForbiddenResponse({
    description: 'Rol distinto de MIEMBRO.',
  })
  async history(
    @CurrentUser() user: User,
    @Query() query: ProgressHistoryQueryDto,
  ): Promise<ProgressHistoryResponseDto> {
    const page = await this.service.history(
      user,
      query,
    );

    return ProgressHistoryResponseDto.fromPage(page);
  }

  /**
   * Editar un registro propio.
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'H24. Editar registro de progreso',
  })
  @ApiOkResponse({
    type: ProgressRecordResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Identificador o datos inválidos.',
  })
  @ApiNotFoundResponse({
    description: 'El registro no pertenece al miembro.',
  })
  @ApiConflictResponse({
    description: 'Otro registro ocupa esa fecha.',
  })
  async update(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
    @Body() input: ProgressRecordInputDto,
  ): Promise<ProgressRecordResponseDto> {
    const view = await this.service.update(
      user,
      id,
      input,
    );

    return ProgressRecordResponseDto.fromView(view);
  }
}
