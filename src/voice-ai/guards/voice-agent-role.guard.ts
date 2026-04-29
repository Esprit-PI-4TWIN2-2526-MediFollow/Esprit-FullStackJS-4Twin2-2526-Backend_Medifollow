import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { VoiceAgentRole } from '../dto/process-voice-command.dto';

const SUPPORTED_ROLES = new Set<string>(Object.values(VoiceAgentRole));

type JwtUser = {
  userId?: string;
  sub?: string;
  role?: string | { name?: string };
  [key: string]: unknown;
};

@Injectable()
export class VoiceAgentRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: JwtUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Missing authenticated user');
    }

    const normalizedRole = this.normalizeRole(user.role);
    if (!normalizedRole || !SUPPORTED_ROLES.has(normalizedRole)) {
      throw new ForbiddenException('Unsupported role for voice agent');
    }

    request.user = {
      ...user,
      userId: typeof user.userId === 'string' ? user.userId : String(user.sub ?? ''),
      role: normalizedRole,
    };

    return true;
  }

  private normalizeRole(roleValue: unknown): string {
    if (typeof roleValue === 'string') {
      return roleValue.trim().toUpperCase();
    }

    if (roleValue && typeof roleValue === 'object' && 'name' in roleValue) {
      const name = (roleValue as { name?: unknown }).name;
      if (typeof name === 'string') {
        return name.trim().toUpperCase();
      }
    }

    return '';
  }
}
