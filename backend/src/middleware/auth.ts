import { createMiddleware } from 'hono/factory';
import type { AppVariables, Env } from '../env';
import { HttpError } from '../errors';
import { AuthService } from '../services/authService';
import { verifyJwt } from '../utils/jwt';

export const authMiddleware = createMiddleware<{ Bindings: Env; Variables: AppVariables }>(
  async (c, next) => {
    const header = c.req.header('Authorization');
    if (!header?.startsWith('Bearer ')) {
      throw new HttpError(401, 'Não autenticado');
    }
    const token = header.slice(7);
    const payload = await verifyJwt(token, c.env.JWT_SECRET);
    if (!payload) throw new HttpError(401, 'Sessão inválida ou expirada');

    // Confirma role atual no perfil (não confia só no JWT antigo)
    const profile = await new AuthService(c.env).getProfile(payload.sub);
    c.set('userId', profile.id);
    c.set('userEmail', profile.email);
    c.set('userRole', profile.role);
    await next();
  },
);

export const adminMiddleware = createMiddleware<{ Bindings: Env; Variables: AppVariables }>(
  async (c, next) => {
    if (c.get('userRole') !== 'admin') {
      throw new HttpError(403, 'Acesso restrito a administradores');
    }
    await next();
  },
);
