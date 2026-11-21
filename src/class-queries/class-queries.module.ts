import { Module } from '@nestjs/common';
import { PrismaModule } from '@Prisma';
import { ClassQueriesController } from './controllers/index.js';
import { ClassSessionRepository } from './repositories/index.js';
import { ClassQueriesService } from './services/index.js';

@Module({
  imports: [PrismaModule],
  controllers: [ClassQueriesController],
  providers: [ClassQueriesService, ClassSessionRepository],
  exports: [ClassQueriesService, ClassSessionRepository],
})
export class ClassQueriesModule {}
