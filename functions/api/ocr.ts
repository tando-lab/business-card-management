import { assertAllowedUser, handleError, json, readJson } from '../_lib/http';
import type { AppEnv, RawCardPayload } from '../_lib/types';

interface OcrProxyPayload extends RawCardPayload {
  ocrLanguage?: string;
}

export const onRequestPost: PagesFunction<AppEnv> = async ({ request, env }) => {
  try {
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
  } catch (err) {
    return handleError(err);
  }
};
