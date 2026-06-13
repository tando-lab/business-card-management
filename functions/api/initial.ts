import { assertAllowedUser, handleError, json, todayJst } from '../_lib/http';
import type { AppEnv } from '../_lib/types';

export const onRequestGet: PagesFunction<AppEnv> = async ({ request, env }) => {
  try {
    const user = assertAllowedUser(request, env);
    return json({
      ok: true,
      appTitle: env.APP_TITLE || '名刺共有台帳',
      userEmail: user.email,
      authenticated: user.authenticated,
      today: todayJst(),
      metadata: {
        releaseId: 'cloudflare-ts-r0.1',
        appVersion: '0.1.0-ts-r46-port',
        displayVersion: 'Cloudflare移植 初期版 TypeScript',
        schemaVersion: 'r46-d1-0001',
        buildLabel: 'business-card-cloudflare-typescript',
        buildBadge: 'Cloudflare / TypeScript / Pages Functions / D1 / R2',
        commentLanguage: 'ja',
        distRoot: 'public'
      }
    });
  } catch (err) {
    return handleError(err);
  }
};
