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
  app.useGlobalPipes(new ValidationPipe());

  // CORS configuration with environment variable
  const frontendUrl = process.env.FRONTEND_URL || 'https://medifollow.netlify.app';
  app.enableCors({
    origin: [frontendUrl],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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

  // Swagger configuration (only in development)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('MediFollow API')
      .setDescription('Service module')
      .setVersion('1.0')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: ${await app.getUrl()}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}
bootstrap();
