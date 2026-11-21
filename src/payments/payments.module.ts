import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { MembershipsModule } from '../memberships/memberships.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PaymentsController } from './controllers/index.js';
import { PaymentsRepository } from './repositories/index.js';
import { PaymentsService } from './services/index.js';

/**
 * Dominio de cobros (H16-H21).
 *
 * Depende de Membresías porque el pago de concepto `MEMBRESIA` es lo que activa
 * la solicitud: la membresa nace en la misma transacción que marca el cobro
 * como `PAGADO` (H2). Por eso PaymentsModule importa MembershipsModule y no al
 * revés, para que el grafo de módulos siga siendo un DAG.
 */
@Module({
  imports: [PrismaModule, MembershipsModule, NotificationsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsRepository],
  exports: [PaymentsService, PaymentsRepository],
})
export class PaymentsModule {}
