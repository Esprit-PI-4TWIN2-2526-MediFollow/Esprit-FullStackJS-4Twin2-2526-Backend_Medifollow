import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { IdEncryptionUtil } from '../utils/id-encryption.util';

/**
 * Custom parameter decorator to automatically decode encrypted IDs
 * Usage: @DecodedId() id: string
 * 
 * This replaces @Param('id') and automatically decodes the ID if it's encrypted
 * Only active in production when ENABLE_ID_ENCRYPTION is true
 */
export const DecodedId = createParamDecorator(
  (paramName: string = 'id', ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const encodedId = request.params[paramName];
    
    if (!encodedId) {
      return encodedId;
    }

    // Only decode in production when encryption is enabled
    const isProduction = process.env.NODE_ENV === 'production';
    const encryptionEnabled = process.env.ENABLE_ID_ENCRYPTION === 'true';
    
    if (isProduction && encryptionEnabled) {
      return IdEncryptionUtil.decodeId(encodedId);
    }

    return encodedId;
  },
);

/**
 * Decorator for patient ID
 */
export const DecodedPatientId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const encodedId = request.params['patientId'];
    
    if (!encodedId) return encodedId;

    const isProduction = process.env.NODE_ENV === 'production';
    const encryptionEnabled = process.env.ENABLE_ID_ENCRYPTION === 'true';
    
    if (isProduction && encryptionEnabled) {
      return IdEncryptionUtil.decodeId(encodedId);
    }

    return encodedId;
  },
);

/**
 * Decorator for consultation ID
 */
export const DecodedConsultationId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const encodedId = request.params['consultationId'];
    
    if (!encodedId) return encodedId;

    const isProduction = process.env.NODE_ENV === 'production';
    const encryptionEnabled = process.env.ENABLE_ID_ENCRYPTION === 'true';
    
    if (isProduction && encryptionEnabled) {
      return IdEncryptionUtil.decodeId(encodedId);
    }

    return encodedId;
  },
);
