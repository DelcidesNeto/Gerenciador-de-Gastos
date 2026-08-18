import { Hono } from 'hono';
import type { AppVariables, Env } from '../env';
import {
  contributionSchema,
  investmentSchema,
  investmentUpdateSchema,
  simulateWithdrawalSchema,
  withdrawSchema,
} from '../models/schemas';
import { authMiddleware } from '../middleware/auth';
import { InvestmentService } from '../services/investmentService';

export const investmentRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

investmentRoutes.use('*', authMiddleware);

investmentRoutes.get('/', async (c) => {
  const items = await new InvestmentService(c.env).list(c.get('userId'));
  return c.json({ items });
});

investmentRoutes.get('/summary', async (c) => {
  const asOf = c.req.query('asOf') ?? undefined;
  const result = await new InvestmentService(c.env).summary(c.get('userId'), asOf);
  return c.json(result);
});

investmentRoutes.get('/:id', async (c) => {
  const item = await new InvestmentService(c.env).get(c.get('userId'), c.req.param('id'));
  return c.json({ item });
});

investmentRoutes.get('/:id/performance', async (c) => {
  const asOf = c.req.query('asOf') ?? undefined;
  const result = await new InvestmentService(c.env).performance(
    c.get('userId'),
    c.req.param('id'),
    asOf,
  );
  return c.json(result);
});

investmentRoutes.post('/', async (c) => {
  const body = investmentSchema.parse(await c.req.json());
  const item = await new InvestmentService(c.env).create(c.get('userId'), body);
  return c.json({ item }, 201);
});

investmentRoutes.put('/:id', async (c) => {
  const body = investmentUpdateSchema.parse(await c.req.json());
  const item = await new InvestmentService(c.env).update(c.get('userId'), c.req.param('id'), body);
  return c.json({ item });
});

investmentRoutes.delete('/:id', async (c) => {
  await new InvestmentService(c.env).remove(c.get('userId'), c.req.param('id'));
  return c.json({ ok: true });
});

investmentRoutes.post('/:id/contributions', async (c) => {
  const body = contributionSchema.parse(await c.req.json());
  const item = await new InvestmentService(c.env).addContribution(
    c.get('userId'),
    c.req.param('id'),
    body,
  );
  return c.json({ item }, 201);
});

investmentRoutes.put('/:id/contributions/:contributionId', async (c) => {
  const body = contributionSchema.parse(await c.req.json());
  const item = await new InvestmentService(c.env).updateContribution(
    c.get('userId'),
    c.req.param('id'),
    c.req.param('contributionId'),
    body,
  );
  return c.json({ item });
});

investmentRoutes.delete('/:id/contributions/:contributionId', async (c) => {
  const item = await new InvestmentService(c.env).removeContribution(
    c.get('userId'),
    c.req.param('id'),
    c.req.param('contributionId'),
  );
  return c.json({ item });
});

investmentRoutes.post('/:id/simulate-withdrawal', async (c) => {
  const body = simulateWithdrawalSchema.parse(await c.req.json());
  const result = await new InvestmentService(c.env).simulateWithdrawal(
    c.get('userId'),
    c.req.param('id'),
    body.contributionId,
    body.redemptionDate,
    body.amount,
  );
  return c.json(result);
});

investmentRoutes.get('/:id/withdrawals', async (c) => {
  const items = await new InvestmentService(c.env).listWithdrawals(
    c.get('userId'),
    c.req.param('id'),
  );
  return c.json({ items });
});

investmentRoutes.post('/:id/withdrawals', async (c) => {
  const body = withdrawSchema.parse(await c.req.json());
  const result = await new InvestmentService(c.env).withdraw(
    c.get('userId'),
    c.req.param('id'),
    body.contributionId,
    body.redemptionDate,
    body.amount,
  );
  return c.json(result, 201);
});
