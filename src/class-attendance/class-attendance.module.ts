import { Module } from '@nestjs/common';
import { PrismaModule } from '@Prisma';
import { ClassAttendanceController } from './controllers/index.js';
import { ClassAttendanceRepository } from './repositories/index.js';
import { ClassAttendanceService } from './services/index.js';
@Module({
  imports: [PrismaModule],
  controllers: [ClassAttendanceController],
  providers: [ClassAttendanceService, ClassAttendanceRepository],
  exports: [ClassAttendanceService],
})
export class ClassAttendanceModule {}
