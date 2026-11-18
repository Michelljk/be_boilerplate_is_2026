import { Module } from '@nestjs/common';
import { NotificationsController } from './controllers/index.js';
import { NotificationsRepository } from './repositories/index.js';
import {
  MembershipExpiryNoticeScheduler,
  NotificationDispatcher,
  NotificationService,
} from './services/index.js';


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
