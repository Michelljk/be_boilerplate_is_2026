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
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import type { User } from '../../generated/prisma/client.js';
import { PaymentsService } from '../services/index.js';
import {
  PaymentHistoryQueryDto,
  PaymentPendingQueryDto,
  VoidPaymentDto,
} from '../dto/index.js';
@Controller()
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}
  @Get('payments/pending/me')
  @Roles('MIEMBRO')
  @ApiOperation({ summary: 'Listar mis pagos pendientes' })
  @ApiOkResponse({ description: 'Pagos pendientes del miembro' })
  @ApiBadRequestResponse()
  myPending(@CurrentUser() user: User) {
    return this.service.myPending(user.id);
  }
  @Post('payments/:id/card')
  @HttpCode(HttpStatus.OK)
  @Roles('MIEMBRO')
  @ApiOperation({ summary: 'Pagar con tarjeta' })
  @ApiOkResponse({ description: 'Pago procesado' })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  card(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() body: unknown,
  ) {
    return this.service.payCard(id, user.id, body);
  }
  @Get('payments/history/me')
  @Roles('MIEMBRO')
  @ApiOperation({ summary: 'Consultar historial de pagos' })
  @ApiOkResponse({ description: 'Historial paginado' })
  @ApiBadRequestResponse()
  history(@CurrentUser() user: User, @Query() q: PaymentHistoryQueryDto) {
    return this.service.history(user.id, q);
  }
  @Get('payments/pending')
  @Roles('RECEPCION_ADMIN')
  @ApiOperation({ summary: 'Consultar pagos pendientes' })
  @ApiOkResponse({ description: 'Pagos pendientes paginados' })
  @ApiBadRequestResponse()
  pending(@Query() q: PaymentPendingQueryDto) {
    return this.service.pending(q);
  }
  @Get('members/:memberId/payments')
  @Roles('RECEPCION_ADMIN')
  @ApiOkResponse({ description: 'Pagos pendientes del miembro' })
  @ApiNotFoundResponse()
  memberPending(
    @Param('memberId', ParseUUIDPipe) id: string,
    @Query('status') status: string,
  ) {
    return this.service.memberPending(id, status);
  }
  @Post('payments/:id/collect')
  @HttpCode(HttpStatus.OK)
  @Roles('RECEPCION_ADMIN')
  @ApiOkResponse({ description: 'Cobro registrado' })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  collect(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() body: unknown,
  ) {
    return this.service.collect(id, user.id, body);
  }
  @Get('payments')
  @Roles('RECEPCION_ADMIN')
  @ApiOkResponse({ description: 'Pago asociado al comprobante' })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  search(@Query('receiptNumber') number: string) {
    return this.service.voidSearch(number);
  }
  @Patch('payments/:id/void')
  @Roles('RECEPCION_ADMIN')
  @ApiOkResponse({ description: 'Cobro anulado' })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  void(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() body: VoidPaymentDto,
  ) {
    return this.service.void(id, user.id, body.reason);
  }
  @Get('receipts/:id/pdf')
  @Roles('MIEMBRO', 'RECEPCION_ADMIN')
  @ApiProduces('application/pdf')
  @ApiOkResponse({
    description: 'Comprobante PDF',
    content: { 'application/pdf': {} },
  })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  async pdf(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Res() res: Response,
  ) {
    const file = await this.service.receiptPdf(id, user.id, user.role);
    res
      .set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="comprobante.pdf"',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      })
      .send(file);
  }
}
