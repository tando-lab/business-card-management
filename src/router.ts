import { createCard, deleteCard, searchCards, updateCard, type MutationPrecondition } from './lib/cards';
import { assertAllowedUser, handleError, json, readJson, todayJst } from './lib/http';
import type { AppEnv, RawCardPayload } from './lib/types';

interface OcrProxyPayload extends RawCardPayload {
  ocrLanguage?: string;
}

export async function route(request: Request, env: AppEnv, _ctx: ExecutionContext): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return withCommonHeaders(new Response(null, { status: 204 }), request, env);
  }

  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/api/initial' && request.method === 'GET') {
    return withCommonHeaders(await handleInitial(request, env), request, env);
  }

  if (path === '/api/cards') {
    const response = request.method === 'GET'
      ? await handleCardsGet(request, env)
      : request.method === 'POST'
        ? await handleCardsPost(request, env)
        : json({ ok: false, message: 'Use GET/POST' }, { status: 405 });
    return withCommonHeaders(response, request, env);
  }

  const cardId = matchPath(path, /^\/api\/cards\/([^/]+)$/);
  if (cardId) {
    const id = decodeURIComponent(cardId);
    let response: Response;
    if (request.method === 'PUT' || request.method === 'PATCH') {
      response = await handleCardUpdate(request, env, id);
    } else if (request.method === 'DELETE') {
      response = await handleCardDelete(request, env, id);
    } else {
      response = json({ ok: false, message: 'Use PUT/PATCH/DELETE' }, { status: 405 });
    }
    return withCommonHeaders(response, request, env);
  }

  const imageKey = matchPath(path, /^\/api\/images\/(.+)$/);
  if (imageKey && request.method === 'GET') {
    return withCommonHeaders(await handleImageGet(request, env, decodeURIComponent(imageKey)), request, env);
  }

  if (path === '/api/ocr' && request.method === 'POST') {
    return withCommonHeaders(await handleOcrPost(request, env), request, env);
  }

  // Static assets. With [assets].binding=ASSETS this serves public/index.html, app.js, styles.css, etc.
  if (env.ASSETS) {
    const assetResponse = await env.ASSETS.fetch(request);
    return withCommonHeaders(assetResponse, request, env);
  }

  return withCommonHeaders(new Response('not found', { status: 404 }), request, env);
}

async function handleInitial(request: Request, env: AppEnv): Promise<Response> {
  const user = assertAllowedUser(request, env);
  return json({
    ok: true,
    appTitle: env.APP_TITLE || '名刺共有台帳',
    userEmail: user.email,
    authenticated: user.authenticated,
    today: todayJst(),
    metadata: {
      releaseId: 'cloudflare-worker-ts-r0.2',
      appVersion: '0.2.0-worker-ts-r46-port',
      displayVersion: 'Cloudflare移植 初期版 TypeScript / Workers Assets',
      schemaVersion: 'r46-d1-0001',
      buildLabel: 'business-card-cloudflare-worker-typescript',
      buildBadge: 'Cloudflare / TypeScript / Workers / Static Assets / D1 / R2',
      commentLanguage: 'ja',
      distRoot: 'public'
    }
  });
}

async function handleCardsGet(request: Request, env: AppEnv): Promise<Response> {
  assertAllowedUser(request, env);
  assertDb(env);
  const url = new URL(request.url);
  return json(await searchCards(env, {
    keyword: url.searchParams.get('keyword') || '',
    owner: url.searchParams.get('owner') || '',
    tag: url.searchParams.get('tag') || '',
    limit: Number(url.searchParams.get('limit') || env.MAX_SEARCH_RESULTS || 100)
  }));
}

async function handleCardsPost(request: Request, env: AppEnv): Promise<Response> {
  const user = assertAllowedUser(request, env);
  assertDb(env);
  const payload = await readJson<RawCardPayload>(request);
  return json(await createCard(env, payload, user.email, 'cloudflare-ui'), { status: 201 });
}

async function handleCardUpdate(request: Request, env: AppEnv, id: string): Promise<Response> {
  const user = assertAllowedUser(request, env);
  assertDb(env);
  const payload = await readJson<RawCardPayload>(request);
  return json(await updateCard(env, id, payload, user.email));
}

async function handleCardDelete(request: Request, env: AppEnv, id: string): Promise<Response> {
  const user = assertAllowedUser(request, env);
  assertDb(env);
  const payload = await readJson<MutationPrecondition>(request);
  return json(await deleteCard(env, id, payload, user.email));
}

async function handleImageGet(_request: Request, env: AppEnv, key: string): Promise<Response> {
  assertAllowedUser(_request, env);
  if (!env.CARD_IMAGES) {
    return json({ ok: false, message: 'R2 binding CARD_IMAGES が未設定です。' }, { status: 501 });
  }
  const object = await env.CARD_IMAGES.get(key);
  if (!object) return json({ ok: false, message: '画像が見つかりません。' }, { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('Cache-Control', 'private, max-age=3600');
  return new Response(object.body, { headers });
}

async function handleOcrPost(request: Request, env: AppEnv): Promise<Response> {
  assertAllowedUser(request, env);
  if (!env.OCR_API_URL) {
    return json({
      ok: false,
      message: 'OCR_API_URL未設定のため、Cloudflare側のOCRプロキシは未有効です。Apps Script OCR API設定後に利用できます。',
      text: '',
      ocrStatus: 'DISABLED',
      ocrLanguage: 'ja',
      ocrAt: ''
    }, { status: 501 });
  }

  const payload = await readJson<OcrProxyPayload>(request);
  const upstreamPayload = {
    token: env.OCR_API_TOKEN || '',
    image: payload.image || payload.croppedImage || payload.originalImage || null,
    ocrLanguage: payload.ocrLanguage || 'ja'
  };
  const upstream = await fetch(env.OCR_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(upstreamPayload)
  });
  const text = await upstream.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (_err) {
    data = { ok: false, message: 'OCR APIの応答がJSONではありません。', text: '' };
  }
  return json(data, { status: upstream.ok ? 200 : upstream.status });
}

function assertDb(env: AppEnv): void {
  if (!env.DB) {
    throw new Error('D1 binding DB が未設定です。wrangler.json または Cloudflare dashboard で DB binding を設定してください。');
  }
}

function matchPath(path: string, regexp: RegExp): string | null {
  const m = path.match(regexp);
  return m ? m[1] || '' : null;
}

function withCommonHeaders(response: Response, request: Request, env: AppEnv): Response {
  const headers = new Headers(response.headers);
  Object.entries(securityHeaders()).forEach(([key, value]) => headers.set(key, value));
  Object.entries(corsHeaders(request, env)).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

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
