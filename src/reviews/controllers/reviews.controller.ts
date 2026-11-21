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
import { UserRole, type User } from '@PrismaClient';
import {
  AveragesResponseDto,
  CreateReviewDto,
  EligibleSessionsQueryDto,
  EligibleSessionsResponseDto,
  ReviewAveragesQueryDto,
  ReviewResponseDto,
} from '../dto/index.js';
import { ReviewsService } from '../services/index.js';

/**
 * Rutas de H29 y H30. La identidad siempre sale del JWT (`@CurrentUser`);
 * el controlador no valida reglas ni toca Prisma.
 */
@ApiTags('reviews')
@ApiBearerAuth()
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('eligible-sessions')
  @Roles(UserRole.MIEMBRO)
  @ApiOperation({
    summary: 'H29. Sesiones evaluables del miembro autenticado',
    description:
      'Devuelve solo sesiones COMPLETADA con asistencia ASISTIO que el miembro todavía no califica.',
  })
  @ApiOkResponse({ type: EligibleSessionsResponseDto })
  @ApiBadRequestResponse({ description: 'Paginación inválida.' })
  @ApiUnauthorizedResponse({ description: 'Falta un JWT válido.' })
  @ApiForbiddenResponse({
    description: 'Solo la rol MIEMBRO consulta sus sesiones.',
  })
  async eligibleSessions(
    @CurrentUser() user: User,
    @Query() query: EligibleSessionsQueryDto,
  ): Promise<EligibleSessionsResponseDto> {
    const page = await this.reviewsService.findEligibleSessions(user, query);
    return EligibleSessionsResponseDto.fromRows(page.rows, page.total);
  }

  @Post()
  @Roles(UserRole.MIEMBRO)
  @ApiOperation({
    summary: 'H29. Registrar calificación de una sesión',
    description:
      'Una sesión se califica una única vez; no existe edición en esta entrega.',
  })
  @ApiCreatedResponse({ type: ReviewResponseDto })
  @ApiBadRequestResponse({ description: 'Rating o comentario inválido.' })
  @ApiUnauthorizedResponse({ description: 'Falta un JWT válido.' })
  @ApiForbiddenResponse({ description: 'Solo la rol MIEMBRO califica.' })
  @ApiNotFoundResponse({
    description: 'La sesión no existe o es de otro miembro.',
  })
  @ApiConflictResponse({
    description:
      'Sesión no completada, sin asistencia ASISTIO o ya calificada.',
  })
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    const review = await this.reviewsService.createReview(user, dto);
    return ReviewResponseDto.fromRecord(review);
  }

  @Get('averages')
  @Roles(UserRole.RECEPCION_ADMIN)
  @ApiOperation({
    summary: 'H30. Promedio de calificaciones por clase o por entrenador',
    description:
      'averageRating se redondea a 1 decimal y es null cuando la entidad no tiene evaluaciones. Por clase solo se listan las plantillas ACTIVA.',
  })
  @ApiOkResponse({ type: AveragesResponseDto })
  @ApiBadRequestResponse({
    description: 'Agrupación, orden o paginación inválidos.',
  })
  @ApiUnauthorizedResponse({ description: 'Falta un JWT válido.' })
  @ApiForbiddenResponse({
    description: 'MIEMBRO y ENTRENADOR reciben 403 en este reporte.',
  })
  async averages(
    @CurrentUser() user: User,
    @Query() query: ReviewAveragesQueryDto,
  ): Promise<AveragesResponseDto> {
    const page = await this.reviewsService.findAverages(user, query);
    return AveragesResponseDto.fromPage(page);
  }
}
