import { Hono } from 'hono';
import type { AppVariables, Env } from '../env';
import {
  categoryDeleteSchema,
  categoryRenameSchema,
  categorySchema,
} from '../models/schemas';
import { authMiddleware } from '../middleware/auth';
import { CategoryService } from '../services/categoryService';

export const categoryRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

categoryRoutes.use('*', authMiddleware);

categoryRoutes.get('/', async (c) => {
  const categories = await new CategoryService(c.env).listWithUsage(c.get('userId'));
  return c.json({ categories });
});

categoryRoutes.post('/', async (c) => {
  const body = categorySchema.parse(await c.req.json());
  const categories = await new CategoryService(c.env).add(c.get('userId'), body.name);
  return c.json({ categories }, 201);
});

categoryRoutes.put('/rename', async (c) => {
  const body = categoryRenameSchema.parse(await c.req.json());
  const categories = await new CategoryService(c.env).rename(
    c.get('userId'),
    body.from,
    body.to,
  );
  return c.json({ categories });
});

categoryRoutes.delete('/', async (c) => {
  const body = categoryDeleteSchema.parse(await c.req.json());
  const categories = await new CategoryService(c.env).remove(c.get('userId'), body.name);
  return c.json({ categories });
});
