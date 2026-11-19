import { Module } from '@nestjs/common';
import { GymController } from './gym.controller.js';
import { GymService } from './gym.service.js';
@Module({ controllers: [GymController], providers: [GymService] })
export class GymModule {}