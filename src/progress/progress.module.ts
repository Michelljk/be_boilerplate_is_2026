
import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';

import { TrainerProgressController } from './controllers/trainer-progress.controller.js';
import { TrainerProgressService } from './services/trainer-progress.service.js';
import { ProgressTrainerRepository } from './repositories/progress-trainer.repository.js';

/**
 * H26 — Consulta del progreso de miembros
 * asignados al entrenador.
 */
@Module({
  imports: [
    PrismaModule,
  ],
  controllers: [
    TrainerProgressController,
  ],
  providers: [
    TrainerProgressService,
    ProgressTrainerRepository,
  ],
})
export class ProgressModule {}
