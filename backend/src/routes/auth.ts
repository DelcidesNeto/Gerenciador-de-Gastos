import { Hono } from 'hono';
import type { AppVariables, Env } from '../env';
import { loginSchema, registerSchema } from '../models/schemas';
import { authMiddleware } from '../middleware/auth';
import { AuthService } from '../services/authService';

export const authRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

authRoutes.post('/register', async (c) => {
  const body = registerSchema.parse(await c.req.json());
  const result = await new AuthService(c.env).register(body);
  return c.json(result, 201);
});

authRoutes.post('/login', async (c) => {
  const body = loginSchema.parse(await c.req.json());
  const result = await new AuthService(c.env).login(body);
  return c.json(result);
});

authRoutes.post('/logout', authMiddleware, async (c) => {
  // JWT stateless — o cliente descarta o token.
  return c.json({ ok: true });
});

authRoutes.get('/me', authMiddleware, async (c) => {
  const user = await new AuthService(c.env).getMe(c.get('userId'));
  return c.json({ user });
});
