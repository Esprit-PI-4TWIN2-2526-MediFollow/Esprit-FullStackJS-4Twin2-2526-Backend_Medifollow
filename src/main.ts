import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import rateLimit from 'express-rate-limit';
import * as crypto from 'crypto';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

//(global as any).crypto = crypto;
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
  const config = new DocumentBuilder()
    .setTitle('MediFollow API')
    .setDescription('Service module')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

=======
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: 'http://localhost:4200',
  });
>>>>>>> Stashed changes
  await app.listen(3000);
}
bootstrap();
