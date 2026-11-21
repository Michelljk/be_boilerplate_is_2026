import { Module } from '@nestjs/common';
import { NotificationsController } from './controllers/index.js';
import { NotificationsRepository } from './repositories/index.js';
import {
  MembershipExpiryNoticeScheduler,
  NotificationService,
} from './services/index.js';

/**
 * Dominio de avisos (H31, H34 y H35).
 *
 * `NotificationService` es el único canal de entrada de los demás módulos y
 * H31 genera sus avisos con node-cron. No se registra dispatcher ni polling:
 * los productores coordinan `send(..., tx)` dentro de sus propias transacciones.
 */
@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsRepository,
    NotificationService,
    MembershipExpiryNoticeScheduler,
  ],
  exports: [NotificationService, NotificationsRepository],
})
export class NotificationsModule {}
