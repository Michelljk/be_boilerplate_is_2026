import { Module } from '@nestjs/common';
import { AuthModule } from '@Auth';
import { PrismaModule } from '@Prisma';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { ClassReservationsController } from './controllers/index.js';
import {
  ClassReservationReader,
  ClassReservationRepository,
} from './repositories/index.js';
import { ClassReservationsService } from './services/index.js';

@Module({
  imports: [AuthModule, PrismaModule, NotificationsModule],
  controllers: [ClassReservationsController],
  providers: [
    ClassReservationsService,
    ClassReservationRepository,
    ClassReservationReader,
  ],
  exports: [ClassReservationsService],
})
export class ClassReservationsModule {}
