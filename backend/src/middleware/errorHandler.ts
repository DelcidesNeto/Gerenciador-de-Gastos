import type { ErrorHandler } from 'hono';
import { ZodError } from 'zod';
import type { AppVariables, Env } from '../env';
import { HttpError } from '../errors';

export const errorHandler: ErrorHandler<{ Bindings: Env; Variables: AppVariables }> = (err, c) => {
  if (err instanceof ZodError) {
    return c.json(
      {
        error: 'Dados inválidos',
        details: err.flatten(),
      },
      400,
    );
  }
  if (err instanceof HttpError) {
    return c.json(
      { error: err.message, details: err.details },
      err.status as 400 | 401 | 404 | 409 | 500,
    );
  }
  console.error(err);
  return c.json({ error: 'Erro interno do servidor' }, 500);
};
