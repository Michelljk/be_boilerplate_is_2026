import { Module } from '@nestjs/common';
import { PrismaModule } from '@Prisma';
import { ReviewsModule } from '../reviews/reviews.module.js';
import { ReportsController } from './reports.controller.js';
import { ReportsRepository } from './repositories/reports.repository.js';
import { ReportsService } from './reports.service.js';

@Module({
  imports: [PrismaModule, ReviewsModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsRepository],
  exports: [ReportsService],
})
export class ReportsModule {}
