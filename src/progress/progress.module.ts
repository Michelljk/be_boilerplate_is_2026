
import { Module } from '@nestjs/common';

import { CommonModule } from '../common/common.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

import { ProgressController } from './controllers/progress.controller.js';
import { ProgressRecordRepository } from './repositories/progress-record.repository.js';
import { ProgressService } from './services/progress.service.js';

/**
 * H24 — Registro, edición y consulta
 * de progreso físico del miembro.
 */
@Module({
  imports: [
    CommonModule,
    PrismaModule,
  ],
  controllers: [
    ProgressController,
  ],
  providers: [
    ProgressService,
    ProgressRecordRepository,
  ],
})
export class ProgressModule {}
