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
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '@Auth/decorators';
import { UserRole, type User } from '@PrismaClient';
import { ProgressService } from '../services/index.js';
import {
  EvolutionQueryDto,
  ProgressHistoryQueryDto,
} from '../dto/progress-query.dto.js';
import { ProgressRecordInputDto } from '../dto/progress-record-input.dto.js';
import {
  EvolutionResponseDto,
  ProgressHistoryResponseDto,
  ProgressRecordResponseDto,
} from '../dto/progress-record-response.dto.js';

/** Registro y marcas del día (H24) y evolución física (H25). */
@ApiTags('Progreso físico')
@ApiBearerAuth()
@Controller('progress-records')
@Roles(UserRole.MIEMBRO)
export class ProgressController {
  constructor(private readonly service: ProgressService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: ProgressRecordResponseDto })
  @ApiBadRequestResponse({ description: 'Fecha, medidas o marcas inválidas.' })
  @ApiUnauthorizedResponse({ description: 'Sin autenticación.' })
  @ApiForbiddenResponse({ description: 'Rol distinto de MIEMBRO.' })
  @ApiConflictResponse({ description: 'Ya existe un registro para ese día.' })
  async create(
    @CurrentUser() user: User,
    @Body() input: ProgressRecordInputDto,
  ): Promise<ProgressRecordResponseDto> {
    const view = await this.service.create(user, input);
    return ProgressRecordResponseDto.fromView(view);
  }

  @Get('me')
  @ApiOkResponse({ type: ProgressHistoryResponseDto })
  @ApiForbiddenResponse({ description: 'Rol distinto de MIEMBRO.' })
  async history(
    @CurrentUser() user: User,
    @Query() query: ProgressHistoryQueryDto,
  ): Promise<ProgressHistoryResponseDto> {
    const page = await this.service.history(user, query);
    return ProgressHistoryResponseDto.fromPage(page);
  }

  @Get('me/evolution')
  @ApiOkResponse({ type: EvolutionResponseDto })
  @ApiBadRequestResponse({
    description: 'Métrica, rango o ejercicio inválidos.',
  })
  @ApiForbiddenResponse({ description: 'Rol distinto de MIEMBRO.' })
  async evolution(
    @CurrentUser() user: User,
    @Query() query: EvolutionQueryDto,
  ): Promise<EvolutionResponseDto> {
    const view = await this.service.evolution(user, query);
    return EvolutionResponseDto.fromView(view);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ProgressRecordResponseDto })
  @ApiBadRequestResponse({ description: 'Identificador o datos inválidos.' })
  @ApiNotFoundResponse({ description: 'El registro no pertenece al miembro.' })
  @ApiConflictResponse({ description: 'Otro registro ocupa esa fecha.' })
  async update(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: ProgressRecordInputDto,
  ): Promise<ProgressRecordResponseDto> {
    const view = await this.service.update(user, id, input);
    return ProgressRecordResponseDto.fromView(view);
  }
}
