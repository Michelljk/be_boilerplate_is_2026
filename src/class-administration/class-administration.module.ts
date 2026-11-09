import { Module } from '@nestjs/common';
import { GymClock } from '@Common/time';
import { ClassAdministrationController } from './controllers/index.js';
import { ClassAdministrationRepository } from './repositories/index.js';
import { ClassAdministrationService } from './services/index.js';

@Module({
  controllers: [ClassAdministrationController],
  providers: [
    GymClock,
    ClassAdministrationService,
    ClassAdministrationRepository,
  ],
  exports: [ClassAdministrationService, ClassAdministrationRepository],
})
export class ClassAdministrationModule {}
