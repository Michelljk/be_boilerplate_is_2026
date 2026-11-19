
import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';
import { CommonModule } from '../common/common.module.js';

import { PaymentPendingController } from './controllers/payment-pending.controller.js';
import { PaymentsService } from './services/payments.service.js';
import { PaymentsRepository } from './repositories/payments.repository.js';

/**
 * H20 — Consulta administrativa de pagos pendientes.
 */
@Module({
  imports: [
    PrismaModule,
    CommonModule,
  ],
  controllers: [
    PaymentPendingController,
  ],
  providers: [
    PaymentsService,
    PaymentsRepository,
  ],
  exports: [
    PaymentsService,
    PaymentsRepository,
  ],
})
export class PaymentsModule {}
