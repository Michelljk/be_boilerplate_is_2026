import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service.js';
import { NotificationDispatcher } from './services/notification-dispatcher.service.js';
@Module({
  providers: [NotificationService, NotificationDispatcher],
  exports: [NotificationService, NotificationDispatcher],
})
export class NotificationsModule {}
