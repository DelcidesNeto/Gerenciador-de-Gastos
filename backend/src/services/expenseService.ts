import type { Env } from '../env';
import type { Expense } from '../models/schemas';
import {
  deleteKey,
  getJson,
  HttpError,
  listJsonUnderPrefix,
  putJson,
} from '../repositories/r2Json';
import { randomId } from '../utils/crypto';
import { monthKeyFromIso } from '../utils/dates';
import { expenseKey, expensePrefix, r2Prefix } from '../utils/paths';
import { roundMoney } from '../utils/money';

export class ExpenseService {
  constructor(private env: Env) {}

  private prefix(userId: string) {
    return expensePrefix(r2Prefix(this.env), userId);
  }

  private key(userId: string, id: string) {
    return expenseKey(r2Prefix(this.env), userId, id);
  }

  async list(
    userId: string,
    filters?: { from?: string; to?: string; category?: string },
  ): Promise<Expense[]> {
    const all = await listJsonUnderPrefix<Expense>(this.env.APPLICATIONS, this.prefix(userId));
    return all
      .filter((e) => {
        if (filters?.from && e.date < filters.from) return false;
        if (filters?.to && e.date > filters.to) return false;
        if (filters?.category && e.category !== filters.category) return false;
        return true;
      })
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }

  async get(userId: string, id: string): Promise<Expense> {
    const expense = await getJson<Expense>(this.env.APPLICATIONS, this.key(userId, id));
    if (!expense) throw new HttpError(404, 'Gasto não encontrado');
    return expense;
  }

  async create(
    userId: string,
    input: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
  ): Promise<Expense> {
    const now = new Date().toISOString();
    const expense: Expense = {
      id: randomId(),
      description: input.description,
      amount: roundMoney(input.amount),
      date: input.date,
      category: input.category,
      paymentMethod: input.paymentMethod,
      notes: input.notes ?? '',
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
    await putJson(this.env.APPLICATIONS, this.key(userId, expense.id), expense);
    return expense;
  }

  async update(
    userId: string,
    id: string,
    patch: Partial<Omit<Expense, 'id' | 'createdAt' | 'version'>>,
  ): Promise<Expense> {
    const current = await this.get(userId, id);
    const updated: Expense = {
      ...current,
      ...patch,
      amount: patch.amount != null ? roundMoney(patch.amount) : current.amount,
      notes: patch.notes ?? current.notes,
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

  async summaryByMonth(userId: string, month: string) {
    // month: YYYY-MM
    const from = `${month}-01`;
    const to = `${month}-31`;
    const items = await this.list(userId, { from, to });
    const inMonth = items.filter((e) => monthKeyFromIso(e.date) === month);
    const byCategory: Record<string, number> = {};
    let total = 0;
    for (const e of inMonth) {
      byCategory[e.category] = roundMoney((byCategory[e.category] ?? 0) + e.amount);
      total += e.amount;
    }
    return {
      month,
      total: roundMoney(total),
      byCategory,
      count: inMonth.length,
    };
  }

  async byPeriod(userId: string, from: string, to: string) {
    const items = await this.list(userId, { from, to });
    const byCategory: Record<string, number> = {};
    const byMonth: Record<string, number> = {};
    let total = 0;
    for (const e of items) {
      byCategory[e.category] = roundMoney((byCategory[e.category] ?? 0) + e.amount);
      const mk = monthKeyFromIso(e.date);
      byMonth[mk] = roundMoney((byMonth[mk] ?? 0) + e.amount);
      total += e.amount;
    }
    return {
      from,
      to,
      total: roundMoney(total),
      byCategory,
      byMonth,
      count: items.length,
      items,
    };
  }

  async monthlyComparison(userId: string, months: string[]) {
    const result: Array<{ month: string; total: number }> = [];
    for (const month of months) {
      const s = await this.summaryByMonth(userId, month);
      result.push({ month, total: s.total });
    }
    return result;
  }
}
