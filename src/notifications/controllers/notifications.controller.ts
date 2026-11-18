import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '@Auth/decorators';
import { UserRole, type User } from '@PrismaClient';
import { NotificationService } from '../services/index.js';
import {
  MarkReadResponseDto,
  NotificationListResponseDto,
  NotificationQueryDto,
  UnreadCountResponseDto,
} from '../dto/index.js';

/**
 * Bandeja única de notificaciones (H34).
 *
 * Sólo el rol MIEMBRO tiene bandeja: cualquier otro rol recibe 403 por el guard
 * de roles, criterio 8 de la historia.
 */
@ApiTags('Notificaciones')
@ApiBearerAuth()
@Controller('notifications')
@Roles(UserRole.MIEMBRO)
export class NotificationsController {
  constructor(private readonly service: NotificationService) {}

  @Get()
  @ApiOkResponse({ type: NotificationListResponseDto })
  @ApiBadRequestResponse({ description: 'Módulo o página inválidos.' })
  @ApiUnauthorizedResponse({ description: 'Sin autenticación.' })
  @ApiForbiddenResponse({ description: 'Rol sin bandeja.' })
  async list(
    @CurrentUser() user: User,
    @Query() query: NotificationQueryDto,
  ): Promise<NotificationListResponseDto> {
    const page = await this.service.list(user.id, query);
    return NotificationListResponseDto.fromPage(page);
  }

  @Get('unread-count')
  @ApiOkResponse({ type: UnreadCountResponseDto })
  @ApiForbiddenResponse({ description: 'Rol sin bandeja.' })
  unreadCount(@CurrentUser() user: User): Promise<UnreadCountResponseDto> {
    return this.service.unreadCount(user.id) as Promise<UnreadCountResponseDto>;
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: MarkReadResponseDto })
  @ApiBadRequestResponse({ description: 'Identificador mal formado.' })
  @ApiNotFoundResponse({ description: 'La notificación no es del miembro.' })
  @ApiForbiddenResponse({ description: 'Rol sin bandeja.' })
  markRead(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<MarkReadResponseDto> {
    return this.service.markRead(user.id, id) as Promise<MarkReadResponseDto>;
  }
}
