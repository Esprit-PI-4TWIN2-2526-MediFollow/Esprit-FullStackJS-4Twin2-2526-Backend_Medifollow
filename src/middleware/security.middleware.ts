import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Logging basique
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);

    // Headers de sécurité
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');

    // Optionnel : vérifier présence du header Authorization
    if (!req.headers.authorization && !req.originalUrl.startsWith('/auth')) {
      console.warn(`Requête sans Authorization vers ${req.originalUrl}`);
    }

    next();
  }
}
