import { route } from './router';
import { handleError } from './lib/http';
import type { AppEnv } from './lib/types';

export default {
  async fetch(request: Request, env: AppEnv, ctx: ExecutionContext): Promise<Response> {
    try {
      return await route(request, env, ctx);
    } catch (err) {
      return handleError(err);
    }
  }
};
