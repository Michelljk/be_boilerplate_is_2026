
import { Module } from '@nestjs/common';

import { TrainingCatalogController } from './controllers/training-catalog.controller.js';
import { RoutineAssignmentController } from './controllers/index.js';
import { TrainerRoutineVersionController } from './controllers/trainer-routine-version.controller.js';

import { TrainingCatalogService } from './services/training-catalog.service.js';
import { RoutineAssignmentService } from './services/index.js';

import { TrainingCatalogRepository } from './repositories/training-catalog.repository.js';
import { RoutineAssignmentRepository } from './repositories/index.js';

@Module({
  controllers: [
    RoutineAssignmentController,
    TrainingCatalogController,
    TrainerRoutineVersionController,
  ],
  providers: [
    RoutineAssignmentService,
    RoutineAssignmentRepository,
    TrainingCatalogService,
    TrainingCatalogRepository,
  ],
  exports: [
    RoutineAssignmentService,
    RoutineAssignmentRepository,
  ],
})
export class RoutineAssignmentModule {}
