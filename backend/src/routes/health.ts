import { Hono } from 'hono';
import type { Env } from '../env';
import { getJson, putJson } from '../repositories/r2Json';
import { healthProbeKey, r2Prefix } from '../utils/paths';

export const healthRoutes = new Hono<{ Bindings: Env }>();

healthRoutes.get('/health', async (c) => {
  const prefix = r2Prefix(c.env);
  const key = healthProbeKey(prefix);
  const payload = {
    ok: true,
    at: new Date().toISOString(),
    prefix,
  };
  await putJson(c.env.APPLICATIONS, key, payload);
  const readBack = await getJson<typeof payload>(c.env.APPLICATIONS, key);
  return c.json({
    status: 'ok',
    r2: {
      writable: true,
      readable: !!readBack,
      prefix,
    },
  });
});
