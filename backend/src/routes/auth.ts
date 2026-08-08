import { Hono } from 'hono';
import type { AppVariables, Env } from '../env';
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from '../models/schemas';
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
  return c.json({ ok: true });
});

authRoutes.get('/me', authMiddleware, async (c) => {
  const user = await new AuthService(c.env).getMe(c.get('userId'));
  return c.json({ user });
});

authRoutes.put('/me', authMiddleware, async (c) => {
  const body = updateProfileSchema.parse(await c.req.json());
  if (body.name == null && body.email == null) {
    return c.json({ error: 'Informe nome e/ou e-mail para atualizar' }, 400);
  }
  const result = await new AuthService(c.env).updateProfile(c.get('userId'), body);
  return c.json(result);
});

authRoutes.put('/me/password', authMiddleware, async (c) => {
  const body = changePasswordSchema.parse(await c.req.json());
  const result = await new AuthService(c.env).changePassword(c.get('userId'), body);
  return c.json(result);
});
