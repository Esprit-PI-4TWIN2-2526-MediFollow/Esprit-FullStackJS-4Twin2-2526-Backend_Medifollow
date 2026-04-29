import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { IdEncryptionUtil } from '../utils/id-encryption.util';

/**
 * Interceptor to automatically decode encrypted IDs from URL parameters
 * Only active in production when ENABLE_ID_ENCRYPTION is true
 */
@Injectable()
export class IdDecoderInterceptor implements NestInterceptor {
  private readonly isProduction = process.env.NODE_ENV === 'production';
  private readonly encryptionEnabled = process.env.ENABLE_ID_ENCRYPTION === 'true';

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Only decode in production when encryption is enabled
    if (!this.isProduction || !this.encryptionEnabled) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    
    // Decode IDs in URL parameters
    if (request.params) {
      Object.keys(request.params).forEach(key => {
        if (this.isIdParameter(key) && request.params[key]) {
          const decoded = IdEncryptionUtil.decodeId(request.params[key]);
          request.params[key] = decoded;
        }
      });
    }

    // Decode IDs in query parameters
    if (request.query) {
      Object.keys(request.query).forEach(key => {
        if (this.isIdParameter(key) && request.query[key]) {
          const decoded = IdEncryptionUtil.decodeId(request.query[key]);
          request.query[key] = decoded;
        }
      });
    }

    // Don't encode responses - causes circular reference issues
    // Frontend should handle encoding before navigation
    return next.handle();
  }

  /**
   * Check if a parameter name is an ID parameter
   */
  private isIdParameter(key: string): boolean {
    const lowerKey = key.toLowerCase();
    return lowerKey === 'id' || 
           lowerKey.endsWith('id') || 
           lowerKey === '_id';
  }
}
