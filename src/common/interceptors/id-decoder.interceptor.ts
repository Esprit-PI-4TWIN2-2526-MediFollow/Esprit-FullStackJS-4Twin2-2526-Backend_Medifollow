import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { IdEncryptionUtil } from '../utils/id-encryption.util';

/**
 * Interceptor to automatically decode encrypted IDs from URL parameters
 * and encode IDs in responses (only in production)
 */
@Injectable()
export class IdDecoderInterceptor implements NestInterceptor {
  private readonly isProduction = process.env.NODE_ENV === 'production';
  private readonly encryptionEnabled = process.env.ENABLE_ID_ENCRYPTION !== 'false';

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (!this.isProduction || !this.encryptionEnabled) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    
    // Decode IDs in URL parameters
    if (request.params) {
      Object.keys(request.params).forEach(key => {
        if (key.toLowerCase().includes('id') && request.params[key]) {
          const decoded = IdEncryptionUtil.decodeId(request.params[key]);
          request.params[key] = decoded;
        }
      });
    }

    // Decode IDs in query parameters
    if (request.query) {
      Object.keys(request.query).forEach(key => {
        if (key.toLowerCase().includes('id') && request.query[key]) {
          const decoded = IdEncryptionUtil.decodeId(request.query[key]);
          request.query[key] = decoded;
        }
      });
    }

    // Encode IDs in response (optional - can be heavy on performance)
    return next.handle().pipe(
      map(data => {
        // Only encode if explicitly enabled
        if (process.env.ENCODE_RESPONSE_IDS === 'true') {
          return this.encodeResponseIds(data);
        }
        return data;
      })
    );
  }

  /**
   * Recursively encode IDs in response data
   */
  private encodeResponseIds(data: any): any {
    if (!data) return data;

    if (Array.isArray(data)) {
      return data.map(item => this.encodeResponseIds(item));
    }

    if (typeof data === 'object') {
      const encoded: any = {};
      Object.keys(data).forEach(key => {
        if (key === '_id' || key === 'id') {
          encoded[key] = IdEncryptionUtil.encodeId(String(data[key]));
        } else if (key.toLowerCase().endsWith('id') && typeof data[key] === 'string') {
          encoded[key] = IdEncryptionUtil.encodeId(data[key]);
        } else {
          encoded[key] = this.encodeResponseIds(data[key]);
        }
      });
      return encoded;
    }

    return data;
  }
}
