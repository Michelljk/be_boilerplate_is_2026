import { Module } from '@nestjs/common';
import { TrainerSlotsController } from './controllers/index.js';
import { TrainerSlotRepository } from './repositories/index.js';
import { TrainerSlotsService } from './services/index.js';

@Module({
  controllers: [TrainerSlotsController],
  providers: [TrainerSlotsService, TrainerSlotRepository],
  exports: [TrainerSlotsService, TrainerSlotRepository],
})
export class TrainerSlotsModule {}
