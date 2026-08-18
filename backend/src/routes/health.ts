import { Hono } from 'hono';
import type { Env } from '../env';

export const healthRoutes = new Hono<{ Bindings: Env }>();

healthRoutes.get('/health', async (c) => {
  const row = await c.env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>();
  return c.json({
    status: 'ok',
    d1: {
      readable: row?.ok === 1,
    },
  });
});
