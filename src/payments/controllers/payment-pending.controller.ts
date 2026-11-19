
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

import { Roles } from '../../auth/decorators/roles.decorator.js';

import { PaymentPendingQueryDto } from '../dto/payment-pending.dto.js';
import { PaymentsService } from '../services/payments.service.js';

/**
 * H20 — Consulta de pagos pendientes.
 */
@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
@Roles('RECEPCION_ADMIN')
export class PaymentPendingController {
  constructor(
    private readonly service: PaymentsService,
  ) {}

  @Get('pending')
  @ApiOperation({
    summary: 'H20. Consultar pagos pendientes',
  })
  @ApiOkResponse({
    description: 'Listado paginado de pagos pendientes.',
  })
  @ApiBadRequestResponse({
    description: 'Filtros o paginación inválidos.',
  })
  @ApiUnauthorizedResponse({
    description: 'Token ausente o inválido.',
  })
  @ApiForbiddenResponse({
    description:
      'Solo recepción y administración pueden consultar los pagos pendientes.',
  })
  pending(@Query() query: PaymentPendingQueryDto) {
    return this.service.pending(query);
  }
}
