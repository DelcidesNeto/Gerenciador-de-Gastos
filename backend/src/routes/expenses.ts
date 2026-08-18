import { Hono } from 'hono';
import type { AppVariables, Env } from '../env';
import { expenseSchema, expenseUpdateSchema } from '../models/schemas';
import { authMiddleware } from '../middleware/auth';
import { HttpError } from '../errors';
import { ExpenseService } from '../services/expenseService';

export const expenseRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

expenseRoutes.use('*', authMiddleware);

expenseRoutes.get('/', async (c) => {
  const from = c.req.query('from') ?? undefined;
  const to = c.req.query('to') ?? undefined;
  const category = c.req.query('category') ?? undefined;
  const items = await new ExpenseService(c.env).list(c.get('userId'), { from, to, category });
  return c.json({ items });
});

expenseRoutes.get('/summary', async (c) => {
  const month = c.req.query('month');
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    throw new HttpError(400, 'Informe month no formato YYYY-MM');
  }
  const summary = await new ExpenseService(c.env).summaryByMonth(c.get('userId'), month);
  return c.json(summary);
});

expenseRoutes.get('/by-period', async (c) => {
  const from = c.req.query('from');
  const to = c.req.query('to');
  if (!from || !to) throw new HttpError(400, 'Informe from e to (YYYY-MM-DD)');
  const result = await new ExpenseService(c.env).byPeriod(c.get('userId'), from, to);
  return c.json(result);
});

expenseRoutes.get('/compare', async (c) => {
  const monthsParam = c.req.query('months');
  if (!monthsParam) throw new HttpError(400, 'Informe months=YYYY-MM,YYYY-MM');
  const months = monthsParam.split(',').map((m) => m.trim()).filter(Boolean);
  const result = await new ExpenseService(c.env).monthlyComparison(c.get('userId'), months);
  return c.json({ months: result });
});

expenseRoutes.get('/:id', async (c) => {
  const item = await new ExpenseService(c.env).get(c.get('userId'), c.req.param('id'));
  return c.json({ item });
});

expenseRoutes.post('/', async (c) => {
  const body = expenseSchema.parse(await c.req.json());
  const item = await new ExpenseService(c.env).create(c.get('userId'), body);
  return c.json({ item }, 201);
});

expenseRoutes.put('/:id', async (c) => {
  const body = expenseUpdateSchema.parse(await c.req.json());
  const item = await new ExpenseService(c.env).update(c.get('userId'), c.req.param('id'), body);
  return c.json({ item });
});

expenseRoutes.delete('/:id', async (c) => {
  await new ExpenseService(c.env).remove(c.get('userId'), c.req.param('id'));
  return c.json({ ok: true });
});
