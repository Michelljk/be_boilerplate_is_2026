import { Module } from '@nestjs/common';
import { NotificationsController } from './controllers/index.js';
import { NotificationsRepository } from './repositories/index.js';
import {
  MembershipExpiryNoticeScheduler,
  NotificationDispatcher,
  NotificationService,
} from './services/index.js';

/**
 * Dominio de avisos (H31-H35).
 *
 * `NotificationService` es el único canal de entrada de los demás módulos; el
 * despachador consume la mesa de eventos y el programador genera los avisos de
 * vencimiento. Se exportan servicio y repositorio para que pagos, reservas y
 * membresías puedan crear sus avisos en la misma transacción.
 */
@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsRepository,
    NotificationService,
    NotificationDispatcher,
    MembershipExpiryNoticeScheduler,
  ],
  exports: [NotificationService, NotificationsRepository],
})
export class NotificationsModule {}
