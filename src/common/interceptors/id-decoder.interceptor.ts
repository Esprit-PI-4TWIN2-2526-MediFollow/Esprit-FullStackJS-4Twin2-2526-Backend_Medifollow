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
    console.log(`\n========== ID DECODER INTERCEPTOR ==========`);
    console.log(`[ID Decoder] ${request.method} ${request.url}`);
    console.log(`[ID Decoder] Environment: ${process.env.NODE_ENV}`);
    console.log(`[ID Decoder] Encryption Enabled: ${this.encryptionEnabled}`);
    
    // Decode IDs in URL parameters
    if (request.params) {
      console.log(`[ID Decoder] URL Params:`, Object.keys(request.params));
      Object.keys(request.params).forEach(key => {
        if (this.isIdParameter(key) && request.params[key]) {
          const original = request.params[key];
          console.log(`[ID Decoder] Processing param "${key}": ${original.substring(0, 30)}...`);
          
          try {
            const decoded = IdEncryptionUtil.decodeId(original);
            console.log(`[ID Decoder] ✅ Decoded ${key}:`);
            console.log(`[ID Decoder]    Original (encrypted): ${original.substring(0, 40)}...`);
            console.log(`[ID Decoder]    Decoded (MongoDB ID): ${decoded}`);
            console.log(`[ID Decoder]    Is valid MongoDB ID: ${IdEncryptionUtil.isMongoId(decoded)}`);
            request.params[key] = decoded;
          } catch (error) {
            console.error(`[ID Decoder] ❌ Failed to decode ${key}:`, error.message);
            console.error(`[ID Decoder]    Original value: ${original}`);
            // If decoding fails, assume it's already a plain ID
            // This handles cases where IDs might not be encrypted
          }
        }
      });
    }

    // Decode IDs in query parameters
    if (request.query) {
      console.log(`[ID Decoder] Query Params:`, Object.keys(request.query));
      Object.keys(request.query).forEach(key => {
        if (this.isIdParameter(key) && request.query[key]) {
          const original = request.query[key];
          console.log(`[ID Decoder] Processing query "${key}": ${original.substring(0, 30)}...`);
          
          try {
            const decoded = IdEncryptionUtil.decodeId(original);
            console.log(`[ID Decoder] ✅ Decoded query ${key}:`);
            console.log(`[ID Decoder]    Original (encrypted): ${original.substring(0, 40)}...`);
            console.log(`[ID Decoder]    Decoded (MongoDB ID): ${decoded}`);
            console.log(`[ID Decoder]    Is valid MongoDB ID: ${IdEncryptionUtil.isMongoId(decoded)}`);
            request.query[key] = decoded;
          } catch (error) {
            console.error(`[ID Decoder] ❌ Failed to decode query ${key}:`, error.message);
            console.error(`[ID Decoder]    Original value: ${original}`);
            // If decoding fails, assume it's already a plain ID
          }
        }
      });
    }

    console.log(`[ID Decoder] ========== END DECODING ==========\n`);

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
