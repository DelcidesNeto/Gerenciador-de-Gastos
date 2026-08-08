import { createMiddleware } from 'hono/factory';
import type { AppVariables, Env } from '../env';
import { verifyJwt } from '../utils/jwt';
import { HttpError } from '../repositories/r2Json';

export const authMiddleware = createMiddleware<{ Bindings: Env; Variables: AppVariables }>(
  async (c, next) => {
    const header = c.req.header('Authorization');
    if (!header?.startsWith('Bearer ')) {
      throw new HttpError(401, 'Não autenticado');
    }
    const token = header.slice(7);
    const payload = await verifyJwt(token, c.env.JWT_SECRET);
    if (!payload) throw new HttpError(401, 'Sessão inválida ou expirada');
    c.set('userId', payload.sub);
    c.set('userEmail', payload.email);
    await next();
  },
);
