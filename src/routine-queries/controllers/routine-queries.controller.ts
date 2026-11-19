import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '@Auth/decorators';
import { UserRole, type User } from '@PrismaClient';
import {
  RoutineIdParamsDto,
  RoutineQueriesResponseDto,
  RoutineQueryDto,
  RoutineDetailResponseDto,
} from '../dto/routine-queries.dto.js';
import { RoutineQueriesService } from '../services/routine-queries.service.js';

@ApiTags('training-routines')
@ApiBearerAuth()
@Roles(UserRole.MIEMBRO)
@Controller('training-routines')
export class RoutineQueriesController {
  constructor(private readonly routineQueriesService: RoutineQueriesService) {}

  @Get('me')
  @ApiOperation({ summary: 'Consulta de rutina vigente e historial' })
  @ApiOkResponse({ type: RoutineQueriesResponseDto })
  @ApiBadRequestResponse({ description: 'Query inválida.' })
  @ApiUnauthorizedResponse({ description: 'No autenticado.' })
  @ApiForbiddenResponse({ description: 'Acceso denegado.' })
  @ApiConflictResponse({
    description: 'Inconsistencia concurrente de rutinas.',
  })
  async findMine(
    @CurrentUser() user: User,
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    query: RoutineQueryDto,
  ): Promise<RoutineQueriesResponseDto> {
    return this.routineQueriesService.findMine(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta el detalle de una rutina propia' })
  @ApiOkResponse({ type: RoutineDetailResponseDto })
  @ApiBadRequestResponse({
    description: 'El identificador no es un UUID válido.',
  })
  @ApiUnauthorizedResponse({ description: 'No autenticado.' })
  @ApiForbiddenResponse({ description: 'Acceso denegado.' })
  @ApiNotFoundResponse({ description: 'Rutina no encontrada.' })
  async findById(
    @CurrentUser() user: User,
    @Param(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    params: RoutineIdParamsDto,
  ): Promise<RoutineDetailResponseDto> {
    return this.routineQueriesService.findById(user, params.id);
  }
}

@ApiTags('training-routines')
@ApiBearerAuth()
@Roles(UserRole.ENTRENADOR)
@Controller('trainers/me/members')
export class TrainerRoutineQueriesController {
  constructor(private readonly routineQueriesService: RoutineQueriesService) {}

  @Get(':memberId/routines/current')
  @ApiOperation({ summary: 'Consulta rutina vigente de un miembro asignado' })
  @ApiOkResponse({ type: RoutineDetailResponseDto, nullable: true })
  @ApiBadRequestResponse({ description: 'Identificador inválido.' })
  @ApiUnauthorizedResponse({ description: 'No autenticado.' })
  @ApiForbiddenResponse({ description: 'Rol distinto de ENTRENADOR.' })
  @ApiNotFoundResponse({ description: 'Recurso no encontrado.' })
  findCurrentForMember(
    @CurrentUser() user: User,
    @Param('memberId', new ParseUUIDPipe({ version: '4' })) memberId: string,
  ): Promise<RoutineDetailResponseDto | null> {
    return this.routineQueriesService.findCurrentForTrainer(user, memberId);
  }
}
