import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from '@Auth';
import { JwtAuthGuard } from '@Auth/guards';
import { HealthModule } from '@Health';
import { PrismaModule } from '@Prisma';
import { UsersModule } from '@Users';
import { RolesGuard } from '@Common/guards';
import { GkdsModule } from './gkds/gkds.module.js';
import { validateEnv } from '@Config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Si falta DATABASE_URL o JWT_SECRET, la app no arranca.
      validate: validateEnv,
    }),
    PrismaModule,
    HealthModule,
    UsersModule,
    AuthModule,
    GkdsModule,
  ],
  providers: [
    {
      // Todo cerrado por defecto: las rutas públicas se abren con @Public().
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
