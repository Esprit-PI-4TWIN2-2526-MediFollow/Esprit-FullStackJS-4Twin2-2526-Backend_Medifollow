const DEFAULT_MAX_STRING_CHARS = 200;
const DEFAULT_MAX_FIELDS = 30;
const DEFAULT_MAX_DEPTH = 2;

const SENSITIVE_KEYS = new Set([
  'password',
  'newPassword',
  'oldPassword',
  'confirmPassword',
  'token',
  'accessToken',
  'refreshToken',
  'twoFactorToken',
  'twoFactorSecret',
  'secret',
  'otp',
  'code',
  'authorization',
]);

const REDACTED_VALUE = '[redacted]';

export function parseBoolean(value: unknown, defaultValue = false): boolean {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;
  const s = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(s)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(s)) return false;
  return defaultValue;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (value as any).constructor === Object
  );
}

function sanitizeValue(
  value: unknown,
  maxStringChars: number,
  depth: number,
): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    if (value.length <= maxStringChars) return value;
    return `${value.slice(0, maxStringChars)}…(${value.length})`;
  }

  if (typeof value === 'number' || typeof value === 'boolean') return value;

  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) {
    return { _type: 'array', length: value.length };
  }

  if (isPlainObject(value)) {
    if (depth <= 0) return { _type: 'object', keys: Object.keys(value).slice(0, 30) };
    return sanitizeObject(value, {
      maxFields: 20,
      maxStringChars,
      maxDepth: depth,
    });
  }

  return { _type: typeof value };
}

function isSensitiveKey(key: string, extraSensitive: string[] = []): boolean {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEYS.has(key) || SENSITIVE_KEYS.has(normalized as any) || extraSensitive.includes(normalized);
}

export function sanitizeObject(
  input: Record<string, unknown>,
  opts?: {
    maxFields?: number;
    maxStringChars?: number;
    maxDepth?: number;
    extraSensitiveKeys?: string[];
  },
): Record<string, unknown> {
  const maxFields = opts?.maxFields ?? DEFAULT_MAX_FIELDS;
  const maxStringChars = opts?.maxStringChars ?? DEFAULT_MAX_STRING_CHARS;
  const maxDepth = opts?.maxDepth ?? DEFAULT_MAX_DEPTH;
  const extraSensitive =
    opts?.extraSensitiveKeys?.map((k) => k.toLowerCase()) ?? [];

  const out: Record<string, unknown> = {};
  const keys = Object.keys(input).slice(0, maxFields);

  for (const key of keys) {
    const normalized = key.toLowerCase();
    if (SENSITIVE_KEYS.has(key) || SENSITIVE_KEYS.has(normalized as any)) continue;
    if (extraSensitive.includes(normalized)) continue;
    out[key] = sanitizeValue(input[key], maxStringChars, Math.max(maxDepth - 1, 0));
  }

  return out;
}

function buildDiffValue(
  before: unknown,
  after: unknown,
  opts: {
    maxStringChars: number;
    maxDepth: number;
    extraSensitiveKeys: string[];
    depth: number;
  },
): unknown {
  const { maxStringChars, maxDepth, extraSensitiveKeys, depth } = opts;

  if (before === after) return undefined;

  if ((isPlainObject(before) || isPlainObject(after)) && depth < maxDepth) {
    const beforeObject = isPlainObject(before) ? before : {};
    const afterObject = isPlainObject(after) ? after : {};
    const keys = new Set([...Object.keys(beforeObject), ...Object.keys(afterObject)]);
    const out: Record<string, unknown> = {};

    for (const key of keys) {
      if (isSensitiveKey(key, extraSensitiveKeys)) {
        const hasBefore = Object.prototype.hasOwnProperty.call(beforeObject, key);
        const hasAfter = Object.prototype.hasOwnProperty.call(afterObject, key);
        if (hasBefore || hasAfter) {
          out[key] = { from: REDACTED_VALUE, to: REDACTED_VALUE };
        }
        continue;
      }

      const child = buildDiffValue((beforeObject as any)[key], (afterObject as any)[key], {
        maxStringChars,
        maxDepth,
        extraSensitiveKeys,
        depth: depth + 1,
      });

      if (child !== undefined) {
        out[key] = child;
      }
    }

    return Object.keys(out).length > 0 ? out : undefined;
  }

  if (Array.isArray(before) || Array.isArray(after)) {
    const from = Array.isArray(before) ? { _type: 'array', length: before.length } : sanitizeValue(before, maxStringChars, 0);
    const to = Array.isArray(after) ? { _type: 'array', length: after.length } : sanitizeValue(after, maxStringChars, 0);

    return JSON.stringify(from) === JSON.stringify(to) ? undefined : { from, to };
  }

  const from = sanitizeValue(before, maxStringChars, 0);
  const to = sanitizeValue(after, maxStringChars, 0);

  return JSON.stringify(from) === JSON.stringify(to) ? undefined : { from, to };
}

export function buildAuditChanges(
  before: unknown,
  after: unknown,
  opts?: {
    maxStringChars?: number;
    maxDepth?: number;
    extraSensitiveKeys?: string[];
  },
): Record<string, unknown> | undefined {
  const maxStringChars = opts?.maxStringChars ?? DEFAULT_MAX_STRING_CHARS;
  const maxDepth = opts?.maxDepth ?? DEFAULT_MAX_DEPTH;
  const extraSensitiveKeys =
    opts?.extraSensitiveKeys?.map((k) => k.toLowerCase()) ?? [];

  const diff = buildDiffValue(before, after, {
    maxStringChars,
    maxDepth,
    extraSensitiveKeys,
    depth: 0,
  });

  return isPlainObject(diff) ? diff : undefined;
}

export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
