import { Module } from '@nestjs/common';
import { PrismaModule } from '@Prisma';
import { GymClock } from '@Common/time';
import { TrainerAgendaController } from './controllers/trainer-agenda.controller.js';
import { TrainerAgendaRepository } from './repositories/trainer-agenda.repository.js';
import { TrainerAgendaService } from './services/trainer-agenda.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [TrainerAgendaController],
  providers: [GymClock, TrainerAgendaRepository, TrainerAgendaService],
  exports: [TrainerAgendaService, TrainerAgendaRepository],
})
export class TrainerAgendaModule {}
