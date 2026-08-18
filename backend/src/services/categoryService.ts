import type { Env } from '../env';
import { HttpError } from '../errors';
import { DEFAULT_CATEGORIES } from '../models/schemas';

export type CategoryWithUsage = {
  name: string;
  expenseCount: number;
};

type CategoryRow = {
  name: string;
  position: number;
  updated_at: string;
  version: number;
};

export class CategoryService {
  constructor(private env: Env) {}

  async ensureDefaults(userId: string): Promise<string[]> {
    const existing = await this.listNames(userId);
    if (existing.length > 0) return existing;

    const now = new Date().toISOString();
    const stmts = DEFAULT_CATEGORIES.map((name, position) =>
      this.env.DB.prepare(
        `INSERT INTO categories (user_id, name, position, updated_at, version)
         VALUES (?, ?, ?, ?, 1)`,
      ).bind(userId, name, position, now),
    );
    if (stmts.length) await this.env.DB.batch(stmts);
    return [...DEFAULT_CATEGORIES];
  }

  async list(userId: string): Promise<string[]> {
    return this.ensureDefaults(userId);
  }

  async listWithUsage(userId: string): Promise<CategoryWithUsage[]> {
    const categories = await this.list(userId);
    const counts = await this.env.DB.prepare(
      `SELECT category AS name, COUNT(*) AS expense_count
       FROM expenses WHERE user_id = ?
       GROUP BY category`,
    )
      .bind(userId)
      .all<{ name: string; expense_count: number }>();

    const map = new Map((counts.results ?? []).map((r) => [r.name, Number(r.expense_count)]));
    return categories.map((name) => ({
      name,
      expenseCount: map.get(name) ?? 0,
    }));
  }

  async replace(userId: string, categories: string[]): Promise<string[]> {
    const unique = [...new Set(categories.map((c) => c.trim()).filter(Boolean))];
    if (unique.length === 0) throw new HttpError(400, 'Informe ao menos uma categoria');

    const now = new Date().toISOString();
    const versionRow = await this.env.DB.prepare(
      'SELECT MAX(version) AS version FROM categories WHERE user_id = ?',
    )
      .bind(userId)
      .first<{ version: number | null }>();
    const version = (versionRow?.version ?? 0) + 1;

    await this.env.DB.prepare('DELETE FROM categories WHERE user_id = ?').bind(userId).run();
    const stmts = unique.map((name, position) =>
      this.env.DB.prepare(
        `INSERT INTO categories (user_id, name, position, updated_at, version)
         VALUES (?, ?, ?, ?, ?)`,
      ).bind(userId, name, position, now, version),
    );
    await this.env.DB.batch(stmts);
    return unique;
  }

  async add(userId: string, name: string): Promise<CategoryWithUsage[]> {
    const existing = await this.ensureDefaults(userId);
    const trimmed = name.trim();
    if (!trimmed) throw new HttpError(400, 'Informe o nome da categoria');
    if (existing.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      throw new HttpError(409, 'Já existe uma categoria com esse nome');
    }
    await this.replace(userId, [...existing, trimmed]);
    return this.listWithUsage(userId);
  }

  async rename(userId: string, from: string, to: string): Promise<CategoryWithUsage[]> {
    const fromName = from.trim();
    const toName = to.trim();
    if (!fromName || !toName) throw new HttpError(400, 'Informe os nomes da categoria');

    const existing = await this.ensureDefaults(userId);
    const index = existing.findIndex((c) => c.toLowerCase() === fromName.toLowerCase());
    if (index < 0) throw new HttpError(404, 'Categoria não encontrada');
    const currentName = existing[index];

    if (
      currentName.toLowerCase() !== toName.toLowerCase() &&
      existing.some((c) => c.toLowerCase() === toName.toLowerCase())
    ) {
      throw new HttpError(409, 'Já existe uma categoria com esse nome');
    }

    const next = [...existing];
    next[index] = toName;
    await this.replace(userId, next);

    if (currentName !== toName) {
      await this.env.DB.prepare(
        `UPDATE expenses SET category = ?, updated_at = ?, version = version + 1
         WHERE user_id = ? AND category = ?`,
      )
        .bind(toName, new Date().toISOString(), userId, currentName)
        .run();
    }

    return this.listWithUsage(userId);
  }

  async remove(userId: string, name: string): Promise<CategoryWithUsage[]> {
    const trimmed = name.trim();
    const existing = await this.ensureDefaults(userId);
    const found = existing.find((c) => c.toLowerCase() === trimmed.toLowerCase());
    if (!found) throw new HttpError(404, 'Categoria não encontrada');

    const usage = await this.countUsage(userId, found);
    if (usage > 0) {
      throw new HttpError(
        409,
        `Não é possível excluir: existem ${usage} gasto(s) vinculado(s) a esta categoria`,
      );
    }

    if (existing.length <= 1) {
      throw new HttpError(400, 'É necessário manter ao menos uma categoria');
    }

    await this.replace(
      userId,
      existing.filter((c) => c.toLowerCase() !== found.toLowerCase()),
    );
    return this.listWithUsage(userId);
  }

  private async listNames(userId: string): Promise<string[]> {
    const result = await this.env.DB.prepare(
      'SELECT name FROM categories WHERE user_id = ? ORDER BY position ASC, name COLLATE NOCASE ASC',
    )
      .bind(userId)
      .all<CategoryRow>();
    return (result.results ?? []).map((r) => r.name);
  }

  private async countUsage(userId: string, category: string): Promise<number> {
    const row = await this.env.DB.prepare(
      'SELECT COUNT(*) AS count FROM expenses WHERE user_id = ? AND category = ?',
    )
      .bind(userId, category)
      .first<{ count: number }>();
    return Number(row?.count ?? 0);
  }
}
