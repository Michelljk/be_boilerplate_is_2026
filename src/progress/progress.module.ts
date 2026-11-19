import { Module } from '@nestjs/common';
import { ProgressController, TrainerProgressController } from './controllers/index.js';
import {
  ProgressRecordRepository,
  ProgressTrainerRepository,
} from './repositories/index.js';
import { ProgressService, TrainerProgressService } from './services/index.js';

/** Dominio 6: progreso del miembro (H24, H25) y ficha del entrenador (H26). */
@Module({
  controllers: [ProgressController, TrainerProgressController],
  providers: [
    ProgressRecordRepository,
    ProgressTrainerRepository,
    ProgressService,
    TrainerProgressService,
  ],
  exports: [ProgressService, TrainerProgressService],
})
export class ProgressModule {}
