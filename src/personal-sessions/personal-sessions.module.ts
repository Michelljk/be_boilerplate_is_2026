import { Module } from '@nestjs/common';
import { GymClock } from '@Common/time';
import { PrismaModule } from '@Prisma';
import { NotificationsModule } from '../notifications/notifications.module.js';
import {
  PersonalSessionsController,
  TrainerAvailabilityController,
} from './controllers/index.js';
import { PersonalSessionsRepository } from './repositories/index.js';
import { PersonalSessionsService } from './services/index.js';

/**
 * Épica 3 · H10 (agendar) y H11 (cancelar) sesiones personales.
 * El catálogo `GET /trainers` pertenece a `class-administration`; aquí sólo vive
 * `GET /trainers/:trainerId/slots`.
 */
@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [PersonalSessionsController, TrainerAvailabilityController],
  providers: [GymClock, PersonalSessionsRepository, PersonalSessionsService],
  exports: [PersonalSessionsService, PersonalSessionsRepository],
})
export class PersonalSessionsModule {}
