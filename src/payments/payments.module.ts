
import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';

import { PaymentHistoryController } from './controllers/payment-history.controller.js';
import { PaymentsRepository } from './repositories/payments.repository.js';
import { PaymentsService } from './services/payments.service.js';

/**
 * H18 — Módulo de historial de pagos.
 */
@Module({
  imports: [PrismaModule],
  controllers: [PaymentHistoryController],
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
