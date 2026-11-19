import { Module } from '@nestjs/common';
import { PersonalSessionsModule } from '../personal-sessions/personal-sessions.module.js';
import { TrainerSlotsController } from './controllers/index.js';
import { TrainerSlotRepository } from './repositories/index.js';
import { TrainerSlotsService } from './services/index.js';

@Module({
  imports: [PersonalSessionsModule],
  controllers: [TrainerSlotsController],
  providers: [TrainerSlotsService, TrainerSlotRepository],
  exports: [TrainerSlotsService, TrainerSlotRepository],
})
export class TrainerSlotsModule {}
