import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

/**
 * Disable console.log in production for better performance
 * Keeps console.error and console.warn for monitoring
 */
if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEBUG_LOGS !== 'true') {
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
  // Keep console.error and console.warn for production monitoring
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable compression for all responses (gzip)
  app.use(compression());
  
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
  
  // These will only show in development
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Application is running on: ${await app.getUrl()}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  } else {
    // In production, use console.error so it still shows
    console.error(`✅ MediFollow API started on port ${port}`);
  }}
bootstrap();
