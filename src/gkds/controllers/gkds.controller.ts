import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '@Auth/decorators';
import { Roles } from '@Common/decorators';
import { GkdsService } from '../services/gkds.service.js';
@Controller()
export class GkdsController {
  constructor(private readonly service: GkdsService) {}
  @Get('memberships/me') @Roles('MIEMBRO') membership(@CurrentUser() u: any) { return this.service.membership(u.id); }
  @Get('membership-plans') @Roles('RECEPCION_ADMIN') plans(@Query('status') status?: string) { return this.service.plans(status); }
  @Post('membership-plans') @Roles('RECEPCION_ADMIN') createPlan(@Body() d: any) { return this.service.createPlan(d); }
  @Patch('membership-plans/:id') @Roles('RECEPCION_ADMIN') updatePlan(@Param('id') id: string, @Body() d: any) { return this.service.updatePlan(id, d); }
  @Post('memberships/purchases') @Roles('RECEPCION_ADMIN') purchase(@CurrentUser() u: any, @Body() d: any) { return this.service.purchase(u.id, d); }
  @Post('memberships/:id/renewals') @Roles('RECEPCION_ADMIN') renewal(@CurrentUser() u: any, @Param('id') id: string, @Body() d: any) { return this.service.renewal(u.id, id, d); }
  @Get('access/members') @Roles('RECEPCION_ADMIN') members(@Query('q') q: string) { return this.service.searchMembers(q); }
  @Post('access/check-ins') @Roles('RECEPCION_ADMIN') checkIn(@CurrentUser() u: any, @Body() d: any) { return this.service.checkIn(u.id, d); }
  @Get('access/check-ins') @Roles('RECEPCION_ADMIN') history(@Query() q: any) { return this.service.checkInHistory(q); }
  @Get('payments/pending/me') @Roles('MIEMBRO') pendingMine(@CurrentUser() u: any) { return this.service.pendingMine(u.id); }
  @Post('payments/:id/card') @Roles('MIEMBRO') pay(@CurrentUser() u: any, @Param('id') id: string, @Body() d: any) { return this.service.payCard(u.id, id, d); }
  @Get('receipts/:id/pdf') @Roles('MIEMBRO', 'RECEPCION_ADMIN') async pdf(@CurrentUser() u: any, @Param('id') id: string, @Res() res: Response) { const content = await this.service.receiptPdf(u, id); res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="comprobante-${id}.pdf"` }); res.send(content); }
  @Get('members/:memberId/payments') @Roles('RECEPCION_ADMIN') memberPayments(@Param('memberId') id: string) { return this.service.memberPayments(id); }
  @Post('payments/:id/collect') @Roles('RECEPCION_ADMIN') collect(@CurrentUser() u: any, @Param('id') id: string, @Body() d: any) { return this.service.collect(u.id, id, d); }
  @Get('payments/pending') @Roles('RECEPCION_ADMIN') pendingAll(@Query() q: any) { return this.service.pendingAll(q); }
  @Get('payments') @Roles('RECEPCION_ADMIN') findReceipt(@Query('receiptNumber') number: string) { return this.service.findPaymentByReceipt(number); }
  @Patch('payments/:id/void') @Roles('RECEPCION_ADMIN') voidPayment(@CurrentUser() u: any, @Param('id') id: string, @Body() d: any) { return this.service.voidPayment(u.id, id, d); }
}
