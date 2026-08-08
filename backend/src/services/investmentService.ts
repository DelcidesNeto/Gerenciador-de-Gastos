import type { Env } from '../env';
import type { Contribution, Investment } from '../models/schemas';
import {
  deleteKey,
  getJson,
  HttpError,
  listJsonUnderPrefix,
  putJson,
} from '../repositories/r2Json';
import { randomId } from '../utils/crypto';
import { todayIso } from '../utils/dates';
import { investmentKey, investmentPrefix, r2Prefix } from '../utils/paths';
import { roundMoney } from '../utils/money';
import { CdiCacheService } from './cdi/cdiCacheService';
import {
  calculateContributionPerformance,
  type ContributionPerformance,
} from './yieldService';

export type ContributionWithPerformance = Contribution & {
  performance: ContributionPerformance;
};

export class InvestmentService {
  private cdi: CdiCacheService;

  constructor(private env: Env) {
    this.cdi = new CdiCacheService(env);
  }

  private prefix(userId: string) {
    return investmentPrefix(r2Prefix(this.env), userId);
  }

  private key(userId: string, id: string) {
    return investmentKey(r2Prefix(this.env), userId, id);
  }

  async list(userId: string): Promise<Investment[]> {
    const items = await listJsonUnderPrefix<Investment>(
      this.env.APPLICATIONS,
      this.prefix(userId),
    );
    return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async get(userId: string, id: string): Promise<Investment> {
    const item = await getJson<Investment>(this.env.APPLICATIONS, this.key(userId, id));
    if (!item) throw new HttpError(404, 'Investimento não encontrado');
    return item;
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
    const contributions: Contribution[] = (input.contributions ?? []).map((c) => ({
      id: randomId(),
      amount: roundMoney(c.amount),
      date: c.date,
      createdAt: now,
    }));
    const investment: Investment = {
      id: randomId(),
      name: input.name.trim(),
      type: 'cdi_percent',
      cdiPercent: input.cdiPercent,
      contributions,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
    await putJson(this.env.APPLICATIONS, this.key(userId, investment.id), investment);
    return investment;
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
    await putJson(this.env.APPLICATIONS, this.key(userId, id), updated);
    return updated;
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.get(userId, id);
    await deleteKey(this.env.APPLICATIONS, this.key(userId, id));
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
    const updated: Investment = {
      ...current,
      contributions: [...current.contributions, contribution],
      updatedAt: new Date().toISOString(),
      version: current.version + 1,
    };
    await putJson(this.env.APPLICATIONS, this.key(userId, id), updated);
    return updated;
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
    const contributions = [...current.contributions];
    contributions[index] = {
      ...contributions[index],
      amount: roundMoney(input.amount),
      date: input.date,
    };
    const updated: Investment = {
      ...current,
      contributions,
      updatedAt: new Date().toISOString(),
      version: current.version + 1,
    };
    await putJson(this.env.APPLICATIONS, this.key(userId, id), updated);
    return updated;
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
    const updated: Investment = {
      ...current,
      contributions: next,
      updatedAt: new Date().toISOString(),
      version: current.version + 1,
    };
    await putJson(this.env.APPLICATIONS, this.key(userId, id), updated);
    return updated;
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

  async simulateWithdrawal(
    userId: string,
    investmentId: string,
    contributionId: string,
    redemptionDate: string,
  ) {
    const investment = await this.get(userId, investmentId);
    const contribution = investment.contributions.find((c) => c.id === contributionId);
    if (!contribution) throw new HttpError(404, 'Aporte não encontrado');
    if (redemptionDate < contribution.date) {
      throw new HttpError(400, 'Data de resgate anterior ao aporte');
    }
    const rateMap = await this.cdi.getRateMap(redemptionDate);
    const performance = calculateContributionPerformance(
      {
        amount: contribution.amount,
        date: contribution.date,
        cdiPercent: investment.cdiPercent,
      },
      rateMap,
      redemptionDate,
    );
    return {
      investmentId,
      contribution,
      redemptionDate,
      investedAmount: performance.principal,
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
