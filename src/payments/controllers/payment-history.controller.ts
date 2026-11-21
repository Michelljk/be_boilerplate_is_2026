
import {
  Controller,
  Get,
  Query,
} from '@nestjs/common';

import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import type { User } from '../../generated/prisma/client.js';

import {
  PaymentHistoryQueryDto,
  PaymentHistoryResponseDto,
} from '../dto/payment-history.dto.js';

import { PaymentsService } from '../services/payments.service.js';

/**
 * H18 — Consulta del historial de pagos.
 */
@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
@Roles('MIEMBRO')
export class PaymentHistoryController {
  constructor(
    private readonly service: PaymentsService,
  ) {}

  @Get('history/me')
  @ApiOperation({
    summary: 'H18. Consultar historial de pagos del miembro',
  })
  @ApiOkResponse({
    description: 'Historial de pagos paginado.',
    type: PaymentHistoryResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Rango de fechas o paginación inválidos.',
  })
  @ApiUnauthorizedResponse({
    description: 'Token ausente o inválido.',
  })
  @ApiForbiddenResponse({
    description: 'Solo los miembros pueden consultar su historial.',
  })
  history(
    @CurrentUser() user: User,
    @Query() query: PaymentHistoryQueryDto,
  ) {
    return this.service.history(user.id, query);
  }
}
