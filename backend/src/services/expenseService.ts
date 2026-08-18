import type { Env } from '../env';
import { HttpError } from '../errors';
import type { Expense } from '../models/schemas';
import { expenseFromRow, type ExpenseRow } from '../db/mappers';
import { randomId } from '../utils/crypto';
import { monthKeyFromIso } from '../utils/dates';
import { roundMoney } from '../utils/money';

export class ExpenseService {
  constructor(private env: Env) {}

  async list(
    userId: string,
    filters?: { from?: string; to?: string; category?: string },
  ): Promise<Expense[]> {
    const clauses = ['user_id = ?'];
    const binds: unknown[] = [userId];
    if (filters?.from) {
      clauses.push('date >= ?');
      binds.push(filters.from);
    }
    if (filters?.to) {
      clauses.push('date <= ?');
      binds.push(filters.to);
    }
    if (filters?.category) {
      clauses.push('category = ?');
      binds.push(filters.category);
    }

    const result = await this.env.DB.prepare(
      `SELECT * FROM expenses WHERE ${clauses.join(' AND ')} ORDER BY date DESC, created_at DESC`,
    )
      .bind(...binds)
      .all<ExpenseRow>();

    return (result.results ?? []).map(expenseFromRow);
  }

  async get(userId: string, id: string): Promise<Expense> {
    const row = await this.env.DB.prepare('SELECT * FROM expenses WHERE id = ? AND user_id = ?')
      .bind(id, userId)
      .first<ExpenseRow>();
    if (!row) throw new HttpError(404, 'Gasto não encontrado');
    return expenseFromRow(row);
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
    await this.env.DB.prepare(
      `INSERT INTO expenses
        (id, user_id, description, amount, date, category, payment_method, notes, created_at, updated_at, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        expense.id,
        userId,
        expense.description,
        expense.amount,
        expense.date,
        expense.category,
        expense.paymentMethod,
        expense.notes,
        expense.createdAt,
        expense.updatedAt,
        expense.version,
      )
      .run();
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
    await this.env.DB.prepare(
      `UPDATE expenses
       SET description = ?, amount = ?, date = ?, category = ?, payment_method = ?,
           notes = ?, updated_at = ?, version = ?
       WHERE id = ? AND user_id = ?`,
    )
      .bind(
        updated.description,
        updated.amount,
        updated.date,
        updated.category,
        updated.paymentMethod,
        updated.notes,
        updated.updatedAt,
        updated.version,
        id,
        userId,
      )
      .run();
    return updated;
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.get(userId, id);
    await this.env.DB.prepare('DELETE FROM expenses WHERE id = ? AND user_id = ?')
      .bind(id, userId)
      .run();
  }

  async summaryByMonth(userId: string, month: string) {
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
