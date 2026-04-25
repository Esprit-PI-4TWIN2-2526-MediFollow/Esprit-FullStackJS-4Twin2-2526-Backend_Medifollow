import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectConnection } from '@nestjs/mongoose';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Connection } from 'mongoose';
import { AuditorService } from './auditor.service';
import { buildAuditChanges, sanitizeObject } from './auditor.utils';
import type { AuditAction } from './schemas/audit-log.schema';

function controllerEntityName(controllerName?: string): string | undefined {
  if (!controllerName) return undefined;
  return controllerName.endsWith('Controller')
    ? controllerName.slice(0, -'Controller'.length)
    : controllerName;
}

function isLoginEndpoint(method: string, endpoint: string): boolean {
  if (method !== 'POST') return false;
  const e = endpoint.toLowerCase();
  return e.includes('/signin') || e.includes('/login');
}

function actionFromRequest(method: string, endpoint: string): AuditAction | null {
  if (isLoginEndpoint(method, endpoint)) return 'LOGIN';
  if (method === 'POST') return 'CREATE';
  if (method === 'PUT' || method === 'PATCH') return 'UPDATE';
  if (method === 'DELETE') return 'DELETE';
  return null;
}

function toPascalCase(input: string): string {
  return input
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function singularize(name: string): string {
  if (name.endsWith('ies') && name.length > 3) {
    return `${name.slice(0, -3)}y`;
  }

  if (name.endsWith('sses') && name.length > 4) {
    return name.slice(0, -2);
  }

  if (name.endsWith('s') && !name.endsWith('ss') && name.length > 1) {
    return name.slice(0, -1);
  }

  return name;
}

function extractRouteEntity(endpoint: string): string | undefined {
  const path = endpoint.split('?')[0] ?? '';
  const parts = path
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .filter((segment) => segment !== 'api' && !segment.startsWith(':'));

  const first = parts[0];
  if (!first) return undefined;

  const pascal = toPascalCase(first);
  const singular = singularize(pascal);

  return singular || pascal;
}

function candidateModelNames(controllerName: string | undefined, endpoint: string): string[] {
  const candidates = new Set<string>();

  const controllerBase = controllerName ? controllerEntityName(controllerName) : undefined;
  if (controllerBase) {
    candidates.add(controllerBase);
    candidates.add(toPascalCase(controllerBase));
    candidates.add(singularize(controllerBase));
    candidates.add(singularize(toPascalCase(controllerBase)));
  }

  const routeEntity = extractRouteEntity(endpoint);
  if (routeEntity) {
    candidates.add(routeEntity);
    candidates.add(singularize(routeEntity));
  }

  return [...candidates].filter(Boolean);
}

function normalizeAuditValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeAuditValue(item));
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (typeof (value as any).toObject === 'function') {
    return normalizeAuditValue((value as any).toObject());
  }

  if ((value as any)._doc && typeof (value as any)._doc === 'object') {
    return normalizeAuditValue((value as any)._doc);
  }

  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    out[key] = normalizeAuditValue(nested);
  }

  return out;
}

function isPatientSubmissionEndpoint(endpoint: string): boolean {
  return (
    endpoint.includes('/symptoms/response') ||
    /\/questionnaires\/[^/]+\/responses(?:\?|$)/.test(endpoint)
  );
}

@Injectable()
export class AuditorInterceptor implements NestInterceptor {
  constructor(
    private readonly auditorService: AuditorService,
    private readonly jwtService: JwtService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  private resolveModel(controllerName: string | undefined, endpoint: string) {
    const modelNames = new Set(this.connection.modelNames());
    const candidates = candidateModelNames(controllerName, endpoint);
    const hit = candidates.find((name) => modelNames.has(name));
    return hit ? this.connection.model(hit) : undefined;
  }

  private resolveTargetId(req: any): string | undefined {
    const params = req?.params;

    if (!params || typeof params !== 'object') return undefined;

    const directId = params.id ?? params._id ?? params.userId ?? params.uuid;
    if (directId) return String(directId);

    const values = Object.values(params).filter((value) => value !== undefined && value !== null);
    if (values.length === 1) return String(values[0]);

    return undefined;
  }

  private resolveActorUserId(req: any, data: any, action: AuditAction, endpoint: string): string | undefined {
    const authUserId =
      req?.user?.userId ??
      req?.user?.sub ??
      req?.user?.id ??
      req?.user?._id;

    if (authUserId) return String(authUserId);

    const authorization = req?.headers?.authorization ?? req?.headers?.Authorization;
    const bearerToken =
      typeof authorization === 'string' && authorization.toLowerCase().startsWith('bearer ')
        ? authorization.slice(7).trim()
        : '';

    if (bearerToken) {
      try {
        const payload = this.jwtService.verify(bearerToken);
        const tokenUserId =
          payload?.sub ??
          payload?.userId ??
          payload?.id ??
          payload?._id;

        if (tokenUserId) {
          return String(tokenUserId);
        }
      } catch {
        // Ignore invalid tokens here and continue with non-token fallbacks.
      }
    }

    const responseUserId =
      data?.user?.id ??
      data?.user?.userId ??
      data?.userId ??
      data?.id;

    if (responseUserId && action === 'LOGIN') return String(responseUserId);

    const bodyPatientId = req?.body?.patientId;
    const responsePatientId = data?.patientId;

    if (typeof bodyPatientId === 'string' && isPatientSubmissionEndpoint(endpoint)) {
      return bodyPatientId;
    }

    if (typeof responsePatientId === 'string' && isPatientSubmissionEndpoint(endpoint)) {
      return responsePatientId;
    }

    return responseUserId ? String(responseUserId) : undefined;
  }

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    if (!this.auditorService.isEnabled()) return next.handle();

    const http = context.switchToHttp();
    const req: any = http.getRequest();

    const method = String(req?.method ?? '').toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return next.handle();
    }

    const endpoint = String(req?.originalUrl ?? req?.url ?? '');
    const action = actionFromRequest(method, endpoint);
    if (!action) return next.handle();

    const entity = controllerEntityName(context.getClass()?.name);

    const safeParams =
      req?.params && typeof req.params === 'object'
        ? sanitizeObject(req.params, { maxFields: 10 })
        : undefined;
    const targetModel =
      action === 'CREATE' ? undefined : this.resolveModel(context.getClass()?.name, endpoint);
    const targetId = action === 'CREATE' ? undefined : this.resolveTargetId(req);

    let beforeDocument: Record<string, unknown> | undefined;
    if (targetModel && targetId) {
      const previous = await targetModel.findById(targetId).lean().exec();
      if (previous && typeof previous === 'object') {
        beforeDocument = previous as Record<string, unknown>;
      }
    }

    return next.handle().pipe(
      tap((data) => {
        const resolvedUserId = this.resolveActorUserId(req, data, action, endpoint);
        const afterDocument = normalizeAuditValue(data);

        const changes =
          action === 'DELETE'
            ? buildAuditChanges(beforeDocument ?? safeParams, undefined)
            : buildAuditChanges(beforeDocument ?? undefined, afterDocument ?? normalizeAuditValue(req?.body));

        this.auditorService.enqueue({
          userId: resolvedUserId ? String(resolvedUserId) : undefined,
          action,
          method,
          endpoint,
          entity,
          changes: changes as any,
        });
      }),
    );
  }
}
