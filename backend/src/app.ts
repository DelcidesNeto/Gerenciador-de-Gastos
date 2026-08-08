import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppVariables, Env } from './env';
import { errorHandler } from './middleware/errorHandler';
import { authRoutes } from './routes/auth';
import { categoryRoutes } from './routes/categories';
import { expenseRoutes } from './routes/expenses';
import { healthRoutes } from './routes/health';
import { investmentRoutes } from './routes/investments';
import { marketRoutes } from './routes/market';
import { AuthService } from './services/authService';
import { authMiddleware } from './middleware/auth';

export function createApp() {
  const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

  app.use('*', async (c, next) => {
    const origins = (c.env.CORS_ORIGINS || '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    const corsMiddleware = cors({
      origin: (origin) => {
        if (!origin) return origins[0] ?? '*';
        if (origins.includes('*')) return origin;
        return origins.includes(origin) ? origin : origins[0] ?? '';
      },
      allowHeaders: ['Content-Type', 'Authorization'],
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      maxAge: 86400,
    });
    return corsMiddleware(c, next);
  });

  app.onError(errorHandler);

  app.route('/api', healthRoutes);
  app.route('/api/auth', authRoutes);
  app.get('/api/me', authMiddleware, async (c) => {
    const user = await new AuthService(c.env).getMe(c.get('userId'));
    return c.json({ user });
  });
  app.route('/api/expenses', expenseRoutes);
  app.route('/api/categories', categoryRoutes);
  app.route('/api/investments', investmentRoutes);
  app.route('/api/market', marketRoutes);

  app.notFound((c) => c.json({ error: 'Rota não encontrada' }, 404));

  return app;
}
