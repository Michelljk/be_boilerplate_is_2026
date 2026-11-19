import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { DomainExceptionFilter } from './common/filters/domain-exception.filter.js';
import { NotificationValidationFilter } from './common/filters/notification-validation.filter.js';
import type { EnvConfig } from '@Config';
import type { Request, Response, NextFunction } from 'express';
export function configureApplication(
  app: INestApplication,
  corsOrigins: string[] = ['http://localhost:5173'],
): void {
  app.setGlobalPrefix('api/v1');
  // El PDF usa /api; los clientes existentes usan /api/v1. Ambos contratos
  // apuntan al mismo controlador, validación y guardias, sin redirecciones.
  app.use((request: Request, _response: Response, next: NextFunction) => {
    const path = request.url.split('?')[0];
    if (
      (path === '/api' || path.startsWith('/api/')) &&
      path !== '/api/v1' &&
      !path.startsWith('/api/v1/') &&
      path !== '/api/docs' &&
      !path.startsWith('/api/docs/') &&
      path !== '/api/docs-json' &&
      path !== '/api/docs-yaml'
    ) {
      request.url = request.url.replace(/^\/api(?=\/|\?|$)/, '/api/v1');
    }
    next();
  });
  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(
    new DomainExceptionFilter(),
    new NotificationValidationFilter(),
  );
  app.enableShutdownHooks();
  const document = new DocumentBuilder()
    .setTitle('GKDS · Proyecto 2 · Backend')
    .setDescription('API backend GKDS Proyecto 2.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, document),
  );
}
export async function createApplication(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<EnvConfig, true>);
  configureApplication(app, config.get('CORS_ORIGINS', { infer: true }));
  return app;
}
