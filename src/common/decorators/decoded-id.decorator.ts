import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { IdEncryptionUtil } from '../utils/id-encryption.util';

/**
 * Custom parameter decorator to automatically decode encrypted IDs
 * Usage: @DecodedId() id: string
 * 
 * This replaces @Param('id') and automatically decodes the ID if it's encrypted
 */
export const DecodedId = createParamDecorator(
  (paramName: string = 'id', ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const encodedId = request.params[paramName];
    
    if (!encodedId) {
      return encodedId;
    }

    // Only decode in production
    if (process.env.NODE_ENV === 'production' && process.env.ENABLE_ID_ENCRYPTION !== 'false') {
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

    if (process.env.NODE_ENV === 'production' && process.env.ENABLE_ID_ENCRYPTION !== 'false') {
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

    if (process.env.NODE_ENV === 'production' && process.env.ENABLE_ID_ENCRYPTION !== 'false') {
      return IdEncryptionUtil.decodeId(encodedId);
    }

    return encodedId;
  },
);
