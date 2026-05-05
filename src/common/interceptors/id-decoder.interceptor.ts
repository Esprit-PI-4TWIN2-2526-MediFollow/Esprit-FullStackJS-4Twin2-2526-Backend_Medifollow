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
    
    // Log the incoming request for debugging
    console.log(`[ID Decoder] ${request.method} ${request.url}`);
    
    // Decode IDs in URL parameters
    if (request.params) {
      Object.keys(request.params).forEach(key => {
        if (this.isIdParameter(key) && request.params[key]) {
          const original = request.params[key];
          try {
            const decoded = IdEncryptionUtil.decodeId(original);
            console.log(`[ID Decoder] Decoded ${key}: ${original.substring(0, 20)}... → ${decoded}`);
            request.params[key] = decoded;
          } catch (error) {
            console.error(`[ID Decoder] Failed to decode ${key}: ${original}`, error.message);
            // If decoding fails, assume it's already a plain ID
            // This handles cases where IDs might not be encrypted
          }
        }
      });
    }

    // Decode IDs in query parameters
    if (request.query) {
      Object.keys(request.query).forEach(key => {
        if (this.isIdParameter(key) && request.query[key]) {
          const original = request.query[key];
          try {
            const decoded = IdEncryptionUtil.decodeId(original);
            console.log(`[ID Decoder] Decoded query ${key}: ${original.substring(0, 20)}... → ${decoded}`);
            request.query[key] = decoded;
          } catch (error) {
            console.error(`[ID Decoder] Failed to decode query ${key}: ${original}`, error.message);
            // If decoding fails, assume it's already a plain ID
          }
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
