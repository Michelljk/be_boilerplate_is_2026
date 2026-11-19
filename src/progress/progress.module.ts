
import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';

import { ProgressEvolutionController } from './controllers/progress-evolution.controller.js';

import { ProgressEvolutionService } from './services/progress-evolution.service.js';

import { ProgressEvolutionRepository } from './repositories/progress-evolution.repository.js';

/**
 * H25 — Consulta de evolución física.
 */
@Module({
  imports: [PrismaModule],
  controllers: [
    ProgressEvolutionController,
  ],
  providers: [
    ProgressEvolutionService,
    ProgressEvolutionRepository,
  ],
})
export class ProgressModule {}
