import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { DomainExceptionFilter } from './common/filters/domain-exception.filter.js';
export function configureApplication(app: INestApplication): void {
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new DomainExceptionFilter());
  app.enableShutdownHooks();
  const document = new DocumentBuilder()
    .setTitle('GKDS · Proyecto 2 · Backend')
    .setDescription(
      'H4, H5, H7, H9, H12, H22, H23, H27 y H28. Solo backend. Prefijo /api/v1.',
    )
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
  configureApplication(app);
  return app;
}
