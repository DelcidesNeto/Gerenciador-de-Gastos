import { Hono } from 'hono';
import type { AppVariables, Env } from '../env';
import { authMiddleware } from '../middleware/auth';
import { CdiCacheService } from '../services/cdi/cdiCacheService';

export const marketRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

marketRoutes.use('*', authMiddleware);

marketRoutes.get('/cdi', async (c) => {
  const refresh = c.req.query('refresh') === '1';
  const service = new CdiCacheService(c.env);
  const cache = refresh ? await service.ensureRates() : (await service.getCache()) ?? (await service.ensureRates());
  const last = cache.rates[cache.rates.length - 1] ?? null;
  return c.json({
    source: cache.source,
    seriesCode: cache.seriesCode,
    updatedAt: cache.updatedAt,
    ratesCount: cache.rates.length,
    lastRate: last,
  });
});
