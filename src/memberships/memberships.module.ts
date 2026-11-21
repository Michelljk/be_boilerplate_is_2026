import { Module } from '@nestjs/common';
import { MembershipsController } from './controllers/index.js';
import { MembershipsRepository } from './repositories/index.js';
import {
  MembershipExpiryScheduler,
  MembershipsService,
} from './services/index.js';

/** Dominio 1: membresías, planes, compras, renovaciones y vencimientos. */
@Module({
  controllers: [MembershipsController],
  providers: [
    MembershipsRepository,
    MembershipsService,
    MembershipExpiryScheduler,
  ],
  exports: [MembershipsService, MembershipsRepository],
})
export class MembershipsModule {}
