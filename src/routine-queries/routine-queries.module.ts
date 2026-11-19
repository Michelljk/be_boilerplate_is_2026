import { Module } from '@nestjs/common';
import { RoutineQueriesController } from './controllers/index.js';
import { RoutineQueriesRepository } from './repositories/index.js';
import { RoutineQueriesService } from './services/index.js';

@Module({
  controllers: [RoutineQueriesController],
  providers: [RoutineQueriesService, RoutineQueriesRepository],
  exports: [RoutineQueriesService, RoutineQueriesRepository],
})
export class RoutineQueriesModule {}
