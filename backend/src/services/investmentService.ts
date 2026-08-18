import type { Env } from '../env';
import { HttpError } from '../errors';
import type { Contribution, Investment, Withdrawal } from '../models/schemas';
import {
  contributionFromRow,
  investmentFromRow,
  withdrawalFromRow,
  type ContributionRow,
  type InvestmentRow,
  type WithdrawalRow,
} from '../db/mappers';
import { randomId } from '../utils/crypto';
import { todayIso } from '../utils/dates';
import { roundMoney } from '../utils/money';
import { CdiCacheService } from './cdi/cdiCacheService';
import {
  calculateContributionPerformance,
  scalePerformance,
  type ContributionPerformance,
} from './yieldService';

export type ContributionWithPerformance = Contribution & {
  performance: ContributionPerformance;
};

export type WithdrawalPreview = {
  investmentId: string;
  contribution: Contribution;
  redemptionDate: string;
  investedAmount: number;
  remainingPrincipal: number;
  fullRedemption: boolean;
  grossYield: number;
  iof: number;
  incomeTax: number;
  netYield: number;
  netRedemptionValue: number;
  daysHeld: number;
  iofRate: number;
  incomeTaxRate: number;
  projectedBusinessDays: number;
  lastKnownCdiDate: string | null;
};

const MIN_REMAINING = 0.01;

export class InvestmentService {
  private cdi: CdiCacheService;

  constructor(private env: Env) {
    this.cdi = new CdiCacheService(env);
  }

  async list(userId: string): Promise<Investment[]> {
    const result = await this.env.DB.prepare(
      'SELECT * FROM investments WHERE user_id = ? ORDER BY created_at DESC',
    )
      .bind(userId)
      .all<InvestmentRow>();

    const items: Investment[] = [];
    for (const row of result.results ?? []) {
      items.push(await this.withContributions(row));
    }
    return items;
  }

  async get(userId: string, id: string): Promise<Investment> {
    const row = await this.env.DB.prepare(
      'SELECT * FROM investments WHERE id = ? AND user_id = ?',
    )
      .bind(id, userId)
      .first<InvestmentRow>();
    if (!row) throw new HttpError(404, 'Investimento não encontrado');
    return this.withContributions(row);
  }

  async create(
    userId: string,
    input: {
      name: string;
      cdiPercent: number;
      contributions?: Array<{ amount: number; date: string }>;
    },
  ): Promise<Investment> {
    const now = new Date().toISOString();
    const investmentId = randomId();
    const contributions: Contribution[] = (input.contributions ?? []).map((c) => ({
      id: randomId(),
      amount: roundMoney(c.amount),
      date: c.date,
      createdAt: now,
    }));

    const stmts = [
      this.env.DB.prepare(
        `INSERT INTO investments
          (id, user_id, name, type, cdi_percent, created_at, updated_at, version)
         VALUES (?, ?, ?, 'cdi_percent', ?, ?, ?, 1)`,
      ).bind(investmentId, userId, input.name.trim(), input.cdiPercent, now, now),
      ...contributions.map((c) =>
        this.env.DB.prepare(
          `INSERT INTO contributions (id, investment_id, amount, date, created_at)
           VALUES (?, ?, ?, ?, ?)`,
        ).bind(c.id, investmentId, c.amount, c.date, c.createdAt),
      ),
    ];
    await this.env.DB.batch(stmts);

    return {
      id: investmentId,
      name: input.name.trim(),
      type: 'cdi_percent',
      cdiPercent: input.cdiPercent,
      contributions,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
  }

  async update(
    userId: string,
    id: string,
    patch: { name?: string; cdiPercent?: number },
  ): Promise<Investment> {
    const current = await this.get(userId, id);
    const updated: Investment = {
      ...current,
      name: patch.name?.trim() ?? current.name,
      cdiPercent: patch.cdiPercent ?? current.cdiPercent,
      updatedAt: new Date().toISOString(),
      version: current.version + 1,
    };
    await this.env.DB.prepare(
      `UPDATE investments
       SET name = ?, cdi_percent = ?, updated_at = ?, version = ?
       WHERE id = ? AND user_id = ?`,
    )
      .bind(updated.name, updated.cdiPercent, updated.updatedAt, updated.version, id, userId)
      .run();
    return updated;
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.get(userId, id);
    await this.env.DB.prepare('DELETE FROM investments WHERE id = ? AND user_id = ?')
      .bind(id, userId)
      .run();
  }

  async addContribution(
    userId: string,
    id: string,
    input: { amount: number; date: string },
  ): Promise<Investment> {
    const current = await this.get(userId, id);
    const contribution: Contribution = {
      id: randomId(),
      amount: roundMoney(input.amount),
      date: input.date,
      createdAt: new Date().toISOString(),
    };
    const updatedAt = new Date().toISOString();
    await this.env.DB.batch([
      this.env.DB.prepare(
        `INSERT INTO contributions (id, investment_id, amount, date, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).bind(contribution.id, id, contribution.amount, contribution.date, contribution.createdAt),
      this.env.DB.prepare(
        'UPDATE investments SET updated_at = ?, version = version + 1 WHERE id = ? AND user_id = ?',
      ).bind(updatedAt, id, userId),
    ]);
    return {
      ...current,
      contributions: [...current.contributions, contribution],
      updatedAt,
      version: current.version + 1,
    };
  }

  async updateContribution(
    userId: string,
    id: string,
    contributionId: string,
    input: { amount: number; date: string },
  ): Promise<Investment> {
    const current = await this.get(userId, id);
    const index = current.contributions.findIndex((c) => c.id === contributionId);
    if (index < 0) throw new HttpError(404, 'Aporte não encontrado');

    const amount = roundMoney(input.amount);
    const updatedAt = new Date().toISOString();
    await this.env.DB.batch([
      this.env.DB.prepare(
        'UPDATE contributions SET amount = ?, date = ? WHERE id = ? AND investment_id = ?',
      ).bind(amount, input.date, contributionId, id),
      this.env.DB.prepare(
        'UPDATE investments SET updated_at = ?, version = version + 1 WHERE id = ? AND user_id = ?',
      ).bind(updatedAt, id, userId),
    ]);

    const contributions = [...current.contributions];
    contributions[index] = { ...contributions[index], amount, date: input.date };
    return {
      ...current,
      contributions,
      updatedAt,
      version: current.version + 1,
    };
  }

  async removeContribution(
    userId: string,
    id: string,
    contributionId: string,
  ): Promise<Investment> {
    const current = await this.get(userId, id);
    const next = current.contributions.filter((c) => c.id !== contributionId);
    if (next.length === current.contributions.length) {
      throw new HttpError(404, 'Aporte não encontrado');
    }
    const updatedAt = new Date().toISOString();
    await this.env.DB.batch([
      this.env.DB.prepare('DELETE FROM contributions WHERE id = ? AND investment_id = ?').bind(
        contributionId,
        id,
      ),
      this.env.DB.prepare(
        'UPDATE investments SET updated_at = ?, version = version + 1 WHERE id = ? AND user_id = ?',
      ).bind(updatedAt, id, userId),
    ]);
    return {
      ...current,
      contributions: next,
      updatedAt,
      version: current.version + 1,
    };
  }

  async performance(userId: string, id: string, asOfDate = todayIso()) {
    const investment = await this.get(userId, id);
    const rateMap = await this.cdi.getRateMap(asOfDate);
    const contributions: ContributionWithPerformance[] = investment.contributions.map((c) => ({
      ...c,
      performance: calculateContributionPerformance(
        { amount: c.amount, date: c.date, cdiPercent: investment.cdiPercent },
        rateMap,
        asOfDate,
      ),
    }));

    return {
      investment: {
        id: investment.id,
        name: investment.name,
        cdiPercent: investment.cdiPercent,
        type: investment.type,
      },
      asOfDate,
      contributions,
      summary: summarize(contributions.map((c) => c.performance)),
    };
  }

  async summary(userId: string, asOfDate = todayIso()) {
    const investments = await this.list(userId);
    const rateMap = await this.cdi.getRateMap(asOfDate);
    const allPerformances: ContributionPerformance[] = [];
    const perInvestment = investments.map((inv) => {
      const performances = inv.contributions.map((c) =>
        calculateContributionPerformance(
          { amount: c.amount, date: c.date, cdiPercent: inv.cdiPercent },
          rateMap,
          asOfDate,
        ),
      );
      allPerformances.push(...performances);
      return {
        id: inv.id,
        name: inv.name,
        cdiPercent: inv.cdiPercent,
        summary: summarize(performances),
      };
    });

    return { asOfDate, investments: perInvestment, summary: summarize(allPerformances) };
  }

  async listWithdrawals(userId: string, investmentId: string): Promise<Withdrawal[]> {
    await this.get(userId, investmentId);
    const result = await this.env.DB.prepare(
      'SELECT * FROM withdrawals WHERE investment_id = ? ORDER BY date DESC, created_at DESC',
    )
      .bind(investmentId)
      .all<WithdrawalRow>();
    return (result.results ?? []).map(withdrawalFromRow);
  }

  async simulateWithdrawal(
    userId: string,
    investmentId: string,
    contributionId: string,
    redemptionDate: string,
    amount?: number,
  ): Promise<WithdrawalPreview> {
    return this.previewWithdrawal(userId, investmentId, contributionId, redemptionDate, amount);
  }

  async withdraw(
    userId: string,
    investmentId: string,
    contributionId: string,
    redemptionDate: string,
    amount: number,
  ) {
    const preview = await this.previewWithdrawal(
      userId,
      investmentId,
      contributionId,
      redemptionDate,
      amount,
    );
    const now = new Date().toISOString();
    const id = randomId();

    const stmts = [
      this.env.DB.prepare(
        `INSERT INTO withdrawals
          (id, investment_id, contribution_id, date, principal, remaining_principal,
           gross_yield, iof, iof_rate, income_tax, income_tax_rate, net_yield, net_amount,
           days_held, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        id,
        investmentId,
        contributionId,
        redemptionDate,
        preview.investedAmount,
        preview.remainingPrincipal,
        preview.grossYield,
        preview.iof,
        preview.iofRate,
        preview.incomeTax,
        preview.incomeTaxRate,
        preview.netYield,
        preview.netRedemptionValue,
        preview.daysHeld,
        now,
      ),
      this.env.DB.prepare(
        'UPDATE investments SET updated_at = ?, version = version + 1 WHERE id = ? AND user_id = ?',
      ).bind(now, investmentId, userId),
    ];

    if (preview.fullRedemption) {
      stmts.push(
        this.env.DB.prepare('DELETE FROM contributions WHERE id = ? AND investment_id = ?').bind(
          contributionId,
          investmentId,
        ),
      );
    } else {
      stmts.push(
        this.env.DB.prepare(
          'UPDATE contributions SET amount = ? WHERE id = ? AND investment_id = ?',
        ).bind(preview.remainingPrincipal, contributionId, investmentId),
      );
    }

    await this.env.DB.batch(stmts);

    const withdrawal = (await this.env.DB.prepare('SELECT * FROM withdrawals WHERE id = ?')
      .bind(id)
      .first<WithdrawalRow>())!;

    return {
      withdrawal: withdrawalFromRow(withdrawal),
      preview,
      investment: await this.get(userId, investmentId),
    };
  }

  private async previewWithdrawal(
    userId: string,
    investmentId: string,
    contributionId: string,
    redemptionDate: string,
    amount?: number,
  ): Promise<WithdrawalPreview> {
    const investment = await this.get(userId, investmentId);
    const contribution = investment.contributions.find((c) => c.id === contributionId);
    if (!contribution) throw new HttpError(404, 'Aporte não encontrado');
    if (redemptionDate < contribution.date) {
      throw new HttpError(400, 'Data de resgate anterior ao aporte');
    }

    const requested = roundMoney(amount ?? contribution.amount);
    if (requested > contribution.amount + 0.005) {
      throw new HttpError(
        400,
        `Valor maior que o principal do aporte (${roundMoney(contribution.amount).toFixed(2)})`,
      );
    }

    const remaining = roundMoney(contribution.amount - requested);
    const fullRedemption = remaining < MIN_REMAINING;
    const withdrawnPrincipal = fullRedemption ? contribution.amount : requested;
    const share = withdrawnPrincipal / contribution.amount;

    const rateMap = await this.cdi.getRateMap(redemptionDate);
    const full = calculateContributionPerformance(
      {
        amount: contribution.amount,
        date: contribution.date,
        cdiPercent: investment.cdiPercent,
      },
      rateMap,
      redemptionDate,
    );
    const performance = scalePerformance(full, share);

    return {
      investmentId,
      contribution,
      redemptionDate,
      investedAmount: performance.principal,
      remainingPrincipal: fullRedemption ? 0 : remaining,
      fullRedemption,
      grossYield: performance.grossYield,
      iof: performance.iof,
      incomeTax: performance.incomeTax,
      netYield: performance.netYield,
      netRedemptionValue: performance.netRedemptionValue,
      daysHeld: performance.daysHeld,
      iofRate: performance.iofRate,
      incomeTaxRate: performance.incomeTaxRate,
      projectedBusinessDays: performance.projectedBusinessDays,
      lastKnownCdiDate: performance.lastKnownCdiDate,
    };
  }

  private async withContributions(row: InvestmentRow): Promise<Investment> {
    const result = await this.env.DB.prepare(
      'SELECT * FROM contributions WHERE investment_id = ? ORDER BY date ASC, created_at ASC',
    )
      .bind(row.id)
      .all<ContributionRow>();
    return investmentFromRow(row, (result.results ?? []).map(contributionFromRow));
  }
}

function summarize(rows: ContributionPerformance[]) {
  const principal = roundMoney(rows.reduce((s, r) => s + r.principal, 0));
  const grossYield = roundMoney(rows.reduce((s, r) => s + r.grossYield, 0));
  const iof = roundMoney(rows.reduce((s, r) => s + r.iof, 0));
  const incomeTax = roundMoney(rows.reduce((s, r) => s + r.incomeTax, 0));
  const netYield = roundMoney(rows.reduce((s, r) => s + r.netYield, 0));
  const currentValue = roundMoney(rows.reduce((s, r) => s + r.currentValue, 0));
  const netRedemptionValue = roundMoney(rows.reduce((s, r) => s + r.netRedemptionValue, 0));
  return {
    totalInvested: principal,
    grossYield,
    iof,
    incomeTax,
    taxes: roundMoney(iof + incomeTax),
    netYield,
    currentValue,
    netRedemptionValue,
    contributionsCount: rows.length,
  };
}
