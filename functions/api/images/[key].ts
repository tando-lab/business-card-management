import { assertAllowedUser, handleError, json } from '../../_lib/http';
import type { AppEnv } from '../../_lib/types';

type KeyParams = 'key';

export const onRequestGet: PagesFunction<AppEnv, KeyParams> = async ({ request, env, params }) => {
  try {
    assertAllowedUser(request, env);
    if (!env.CARD_IMAGES) {
      return json({ ok: false, message: 'R2 binding CARD_IMAGES が未設定です。' }, { status: 501 });
    }
    const key = decodeURIComponent(params.key || '');
    const object = await env.CARD_IMAGES.get(key);
    if (!object) return json({ ok: false, message: '画像が見つかりません。' }, { status: 404 });
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Cache-Control', 'private, max-age=3600');
    return new Response(object.body, { headers });
  } catch (err) {
    return handleError(err);
  }
};
