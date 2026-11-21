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
import { ClassAttendanceModule } from './class-attendance/index.js';
import { ClassQueriesModule } from './class-queries/index.js';
import { ClassReservationsModule } from './class-reservations/index.js';
import { ClassAdministrationModule } from './class-administration/index.js';
import { TrainerSlotsModule } from './trainer-slots/index.js';
import { TrainerAgendaModule } from './trainer-agenda/index.js';
import { RoutineAssignmentModule } from './routine-assignment/index.js';
import { RoutineQueriesModule } from './routine-queries/index.js';
import { MachineAdministrationModule } from './machine-administration/index.js';
import { MachineQueriesModule } from './machine-queries/index.js';
import { MembershipsModule } from './memberships/memberships.module.js';
import { AccessModule } from './access/access.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { ProgressModule } from './progress/progress.module.js';
import { ReviewsModule } from './reviews/reviews.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';

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
    ClassAttendanceModule,
    ClassQueriesModule,
    ClassReservationsModule,
    ClassAdministrationModule,
    TrainerSlotsModule,
    TrainerAgendaModule,
    RoutineAssignmentModule,
    RoutineQueriesModule,
    MachineAdministrationModule,
    MachineQueriesModule,
    MembershipsModule,
    AccessModule,
    PaymentsModule,
    ProgressModule,
    ReviewsModule,
    ReportsModule,
    NotificationsModule,
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
