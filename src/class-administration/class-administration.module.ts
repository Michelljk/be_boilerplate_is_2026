import { Module } from '@nestjs/common';
import { GymClock } from '@Common/time';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { ClassAdministrationController } from './controllers/index.js';
import { ClassAdministrationRepository } from './repositories/index.js';
import { ClassAdministrationService } from './services/index.js';

@Module({
  imports: [NotificationsModule],
  controllers: [ClassAdministrationController],
  providers: [
    GymClock,
    ClassAdministrationService,
    ClassAdministrationRepository,
  ],
  exports: [ClassAdministrationService, ClassAdministrationRepository],
})
export class ClassAdministrationModule {}
