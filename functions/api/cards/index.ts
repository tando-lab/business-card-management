import { assertAllowedUser, handleError, json, readJson } from '../../_lib/http';
import { createCard, searchCards } from '../../_lib/cards';
import type { AppEnv, RawCardPayload } from '../../_lib/types';

export const onRequestGet: PagesFunction<AppEnv> = async ({ request, env }) => {
  try {
    assertAllowedUser(request, env);
    const url = new URL(request.url);
    const result = await searchCards(env, {
      keyword: url.searchParams.get('keyword') || '',
      owner: url.searchParams.get('owner') || '',
      tag: url.searchParams.get('tag') || '',
      limit: Number(url.searchParams.get('limit') || env.MAX_SEARCH_RESULTS || 100)
    });
    return json(result);
  } catch (err) {
    return handleError(err);
  }
};

export const onRequestPost: PagesFunction<AppEnv> = async ({ request, env }) => {
  try {
    const user = assertAllowedUser(request, env);
    const payload = await readJson<RawCardPayload>(request);
    const result = await createCard(env, payload, user.email, 'cloudflare-ui');
    return json(result, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
};
