import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import rateLimit from 'express-rate-limit';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
<<<<<<< Updated upstream
  app.useGlobalPipes(new ValidationPipe());

  app.enableCors({
    origin: 'http://localhost:4200',
  });

  // Limiter nb itérations pour prévenir les attaques par force brute
  app.use(
    '/auth/signin',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      message: { message: 'Trop de tentatives, réessayez plus tard' },
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

=======
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: 'http://localhost:4200',
  });
>>>>>>> Stashed changes
  await app.listen(3000);
}
bootstrap();
