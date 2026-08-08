import { Hono } from 'hono';
import type { AppVariables, Env } from '../env';
import { adminMiddleware, authMiddleware } from '../middleware/auth';
import { AuthService } from '../services/authService';

export const adminRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

adminRoutes.use('*', authMiddleware, adminMiddleware);

adminRoutes.get('/users', async (c) => {
  const users = await new AuthService(c.env).listUsers();
  return c.json({ users });
});

adminRoutes.delete('/users/:id', async (c) => {
  const result = await new AuthService(c.env).deleteUser(c.get('userId'), c.req.param('id'));
  return c.json(result);
});
