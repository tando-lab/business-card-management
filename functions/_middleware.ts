import type { AppEnv } from './_lib/types';

export const onRequest: PagesFunction<AppEnv> = async (context) => {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(context.request, context.env) });
  }

  const response = await context.next();
  const headers = new Headers(response.headers);
  Object.entries(securityHeaders()).forEach(([key, value]) => headers.set(key, value));
  Object.entries(corsHeaders(context.request, context.env)).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
};

function securityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(self), microphone=()'
  };
}

function corsHeaders(request: Request, env: AppEnv): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const allowOrigin = allowed.length === 0 || allowed.includes(origin) ? (origin || '*') : (allowed[0] || '*');
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With,X-Dev-User-Email',
    'Access-Control-Max-Age': '86400'
  };
}
