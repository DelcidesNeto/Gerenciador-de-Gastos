import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppVariables, Env } from './env';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';
import { changePasswordSchema, updateProfileSchema } from './models/schemas';
import { adminRoutes } from './routes/admin';
import { authRoutes } from './routes/auth';
import { categoryRoutes } from './routes/categories';
import { expenseRoutes } from './routes/expenses';
import { healthRoutes } from './routes/health';
import { investmentRoutes } from './routes/investments';
import { marketRoutes } from './routes/market';
import { AuthService } from './services/authService';

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
        if (origins.includes(origin)) return origin;
        if (isPrivateNetworkOrigin(origin)) return origin;
        return origins[0] ?? '';
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
  app.put('/api/me', authMiddleware, async (c) => {
    const body = updateProfileSchema.parse(await c.req.json());
    if (body.name == null && body.email == null) {
      return c.json({ error: 'Informe nome e/ou e-mail para atualizar' }, 400);
    }
    const result = await new AuthService(c.env).updateProfile(c.get('userId'), body);
    return c.json(result);
  });
  app.put('/api/me/password', authMiddleware, async (c) => {
    const body = changePasswordSchema.parse(await c.req.json());
    const result = await new AuthService(c.env).changePassword(c.get('userId'), body);
    return c.json(result);
  });
  app.route('/api/admin', adminRoutes);
  app.route('/api/expenses', expenseRoutes);
  app.route('/api/categories', categoryRoutes);
  app.route('/api/investments', investmentRoutes);
  app.route('/api/market', marketRoutes);

  app.notFound((c) => c.json({ error: 'Rota não encontrada' }, 404));

  return app;
}

function isPrivateNetworkOrigin(origin: string): boolean {
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== 'http:' && protocol !== 'https:') return false;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    return false;
  } catch {
    return false;
  }
}
