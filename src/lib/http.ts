import type { AppEnv, AuthUser } from './types';

export interface ApiErrorBody {
  ok: false;
  message: string;
  error: {
    code: string;
    message: string;
    fieldId?: string | undefined;
  };
}

export function json<T>(data: T, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function error(code: string, message: string, status = 400, fieldId?: string): Response {
  const body: ApiErrorBody = { ok: false, message, error: { code, message } };
  if (fieldId) body.error.fieldId = fieldId;
  return json(body, { status });
}

export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T> {
  const text = await request.text();
  if (!text.trim()) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch (_err) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'JSONの形式が正しくありません。');
  }
}

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldId?: string | undefined;

  constructor(status: number, code: string, message: string, fieldId?: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.fieldId = fieldId;
  }
}

export function handleError(err: unknown): Response {
  if (err instanceof HttpError) {
    return error(err.code, err.message, err.status, err.fieldId);
  }
  const message = err instanceof Error ? err.message : 'サーバーエラーが発生しました。';
  return error('UNKNOWN_ERROR', message, 500);
}

export function getRequestUserEmail(request: Request, env: AppEnv): string {
  // Cloudflare Access有効時に付与されるヘッダーを優先します。
  const accessEmail = request.headers.get('Cf-Access-Authenticated-User-Email') || '';
  // ローカル開発用。Cloudflareへ公開する場合はAccessの利用を前提にしてください。
  const devEmail = env.ALLOW_DEV_USER_HEADER === 'true'
    ? request.headers.get('X-Dev-User-Email') || ''
    : '';
  return (accessEmail || devEmail).trim().toLowerCase();
}

export function assertAllowedUser(request: Request, env: AppEnv): AuthUser {
  const email = getRequestUserEmail(request, env);
  const allowedDomains = (env.ALLOWED_EMAIL_DOMAINS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (!email) {
    // Cloudflare Accessをまだ付けていない初期検証でもUIを触れるように、未認証は空ユーザーとして許容します。
    // 本番ではCloudflare Access側で必ず保護してください。
    return { email: '', authenticated: false, allowed: false };
  }

  const domain = email.split('@')[1] || '';
  const allowed = allowedDomains.length === 0 || allowedDomains.includes(domain);
  if (!allowed) {
    throw new HttpError(403, 'PERMISSION_ERROR', '許可されていないメールドメインです。');
  }
  return { email, authenticated: true, allowed: true };
}

export function nowJstText(): string {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  return formatter.format(new Date()).replace(' ', ' ');
}

export function todayJst(): string {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(new Date());
}
