import { Module } from '@nestjs/common';
import { PrismaModule } from '@Prisma';
import { ReviewsController } from './controllers/index.js';
import { ReviewsRepository } from './repositories/index.js';
import { ReviewsService } from './services/index.js';

@Module({
  imports: [PrismaModule],
  controllers: [ReviewsController],
  providers: [ReviewsService, ReviewsRepository],
  exports: [ReviewsRepository, ReviewsService],
})
export class ReviewsModule {}
