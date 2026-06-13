import { assertAllowedUser, handleError, json, readJson } from '../../_lib/http';
import { deleteCard, updateCard, type MutationPrecondition } from '../../_lib/cards';
import type { AppEnv, RawCardPayload } from '../../_lib/types';

type IdParams = 'id';

export const onRequestPut: PagesFunction<AppEnv, IdParams> = (context) => update(context);
export const onRequestPatch: PagesFunction<AppEnv, IdParams> = (context) => update(context);

export const onRequestDelete: PagesFunction<AppEnv, IdParams> = async ({ request, env, params }) => {
  try {
    const user = assertAllowedUser(request, env);
    const payload = await readJson<MutationPrecondition>(request);
    const result = await deleteCard(env, params.id, payload, user.email);
    return json(result);
  } catch (err) {
    return handleError(err);
  }
};

async function update({ request, env, params }: EventContext<AppEnv, IdParams>): Promise<Response> {
  try {
    const user = assertAllowedUser(request, env);
    const payload = await readJson<RawCardPayload>(request);
    const result = await updateCard(env, params.id, payload, user.email);
    return json(result);
  } catch (err) {
    return handleError(err);
  }
}
