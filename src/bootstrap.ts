import 'dotenv/config';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Everything `main.ts`'s local `app.listen()` process and the Vercel
 * serverless entry (`api/index.ts`) both need, up to but not including
 * how the resulting app is actually served — factored out so the two
 * entry points can never drift apart.
 */
export async function createNestApp() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');

  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  return app;
}
