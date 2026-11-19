import { Module } from '@nestjs/common';
import { PrismaModule } from '@Prisma';
import {
  AccessController,
  MemberDirectoryController,
} from './controllers/index.js';
import {
  CheckInHistoryRepository,
  CheckInRepository,
  MemberRepository,
} from './repositories/index.js';
import {
  AccessService,
  CheckInHistoryService,
  MemberDirectoryService,
  MemberSearchService,
} from './services/index.js';
import { GymClock } from '@Common/time';
@Module({
  imports: [PrismaModule],
  controllers: [AccessController, MemberDirectoryController],
  providers: [
    GymClock,
    AccessService,
    MemberSearchService,
    MemberDirectoryService,
    CheckInHistoryService,
    CheckInRepository,
    CheckInHistoryRepository,
    MemberRepository,
  ],
  exports: [AccessService, MemberSearchService, CheckInHistoryService],
})
export class AccessModule {}
