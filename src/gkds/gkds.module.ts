import { Module } from '@nestjs/common';
import { GkdsController } from './controllers/gkds.controller.js';
import { GkdsService } from './services/gkds.service.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
@Module({ imports: [NotificationsModule], controllers: [GkdsController], providers: [GkdsService] })
export class GkdsModule {}
