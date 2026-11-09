import { Global, Module } from '@nestjs/common';
import { GymClock } from './time/gym-clock.service.js';
@Global()
@Module({ providers: [GymClock], exports: [GymClock] })
export class CommonModule {}
