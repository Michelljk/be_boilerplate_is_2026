import { Module } from '@nestjs/common';
import { AuthModule } from '@Auth';
import { PrismaModule } from '@Prisma';
import { ClassReservationsController } from './controllers/index.js';
import { ClassReservationRepository } from './repositories/index.js';
import { ClassReservationsService } from './services/index.js';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [ClassReservationsController],
  providers: [ClassReservationsService, ClassReservationRepository],
  exports: [ClassReservationsService],
})
export class ClassReservationsModule {}
