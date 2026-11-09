import { Module } from '@nestjs/common';
import { MachineAdministrationController } from './controllers/index.js';
import { MachineAdministrationRepository } from './repositories/index.js';
import { MachineAdministrationService } from './services/index.js';

@Module({
  controllers: [MachineAdministrationController],
  providers: [MachineAdministrationService, MachineAdministrationRepository],
  exports: [MachineAdministrationService, MachineAdministrationRepository],
})
export class MachineAdministrationModule {}
