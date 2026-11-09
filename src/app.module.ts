import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

import { AuthModule } from '@Auth';
import { JwtAuthGuard, RolesGuard } from '@Auth/guards';
import { HealthModule } from '@Health';
import { PrismaModule } from '@Prisma';
import { UsersModule } from '@Users';
import { validateEnv } from '@Config';

import { CommonModule } from './common/index.js';
import { ClassQueriesModule } from './class-queries/index.js';
import { ClassReservationsModule } from './class-reservations/index.js';
import { ClassAdministrationModule } from './class-administration/index.js';
import { TrainerSlotsModule } from './trainer-slots/index.js';
import { TrainerAgendaModule } from './trainer-agenda/index.js';
import { RoutineAssignmentModule } from './routine-assignment/index.js';
import { RoutineQueriesModule } from './routine-queries/index.js';
import { MachineAdministrationModule } from './machine-administration/index.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    CommonModule,
    PrismaModule,
    HealthModule,
    UsersModule,
    AuthModule,
    ClassQueriesModule,
    ClassReservationsModule,
    ClassAdministrationModule,
    TrainerSlotsModule,
    TrainerAgendaModule,
    RoutineAssignmentModule,
    RoutineQueriesModule,
    MachineAdministrationModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useExisting: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
