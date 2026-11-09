import { TrainingCatalogController } from './controllers/training-catalog.controller.js';
import { TrainingCatalogService } from './services/training-catalog.service.js';
import { TrainingCatalogRepository } from './repositories/training-catalog.repository.js';
import { Module } from '@nestjs/common';
import { RoutineAssignmentController } from './controllers/index.js';
import { RoutineAssignmentRepository } from './repositories/index.js';
import { RoutineAssignmentService } from './services/index.js';

@Module({
  controllers: [RoutineAssignmentController, TrainingCatalogController],
  providers: [
    RoutineAssignmentService,
    RoutineAssignmentRepository,
    TrainingCatalogService,
    TrainingCatalogRepository,
  ],
  exports: [RoutineAssignmentService, RoutineAssignmentRepository],
})
export class RoutineAssignmentModule {}
