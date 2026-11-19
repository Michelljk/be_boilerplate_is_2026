
import { Module } from '@nestjs/common';
import { PrismaModule } from '@Prisma';

import { ClassAttendanceController } from './controllers/class-attendance.controller.js';
import { ClassAttendanceRepository } from './repositories/class-attendance.repository.js';
import {
  CLASS_ATTENDANCE_REPOSITORY,
  ClassAttendanceService,
} from './services/class-attendance.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [ClassAttendanceController],
  providers: [
    ClassAttendanceService,
    ClassAttendanceRepository,
    {
      provide: CLASS_ATTENDANCE_REPOSITORY,
      useExisting: ClassAttendanceRepository,
    },
  ],
  exports: [ClassAttendanceService],
})
export class ClassAttendanceModule {}
