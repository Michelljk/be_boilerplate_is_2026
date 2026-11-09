import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { MachineQueriesController } from './controllers/index.js';
import { MachineQueriesRepository } from './repositories/index.js';
import { MachineQueriesService } from './services/index.js';

@Module({
  imports: [PrismaModule],
  controllers: [MachineQueriesController],
  providers: [MachineQueriesService, MachineQueriesRepository],
  exports: [MachineQueriesService, MachineQueriesRepository],
})
export class MachineQueriesModule {}
