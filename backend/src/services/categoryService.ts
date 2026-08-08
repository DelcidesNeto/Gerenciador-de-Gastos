import type { Env } from '../env';
import { DEFAULT_CATEGORIES, type CategoriesFile, type Expense } from '../models/schemas';
import { getJson, HttpError, listJsonUnderPrefix, putJson } from '../repositories/r2Json';
import { expensePrefix, r2Prefix, userCategoriesKey } from '../utils/paths';

export type CategoryWithUsage = {
  name: string;
  expenseCount: number;
};

export class CategoryService {
  constructor(private env: Env) {}

  private key(userId: string) {
    return userCategoriesKey(r2Prefix(this.env), userId);
  }

  async ensureDefaults(userId: string): Promise<CategoriesFile> {
    const existing = await getJson<CategoriesFile>(this.env.APPLICATIONS, this.key(userId));
    if (existing) return existing;
    const file: CategoriesFile = {
      categories: [...DEFAULT_CATEGORIES],
      updatedAt: new Date().toISOString(),
      version: 1,
    };
    await putJson(this.env.APPLICATIONS, this.key(userId), file);
    return file;
  }

  async list(userId: string): Promise<string[]> {
    const file = await this.ensureDefaults(userId);
    return file.categories;
  }

  async listWithUsage(userId: string): Promise<CategoryWithUsage[]> {
    const [categories, expenses] = await Promise.all([
      this.list(userId),
      listJsonUnderPrefix<Expense>(
        this.env.APPLICATIONS,
        expensePrefix(r2Prefix(this.env), userId),
      ),
    ]);
    const counts = new Map<string, number>();
    for (const expense of expenses) {
      counts.set(expense.category, (counts.get(expense.category) ?? 0) + 1);
    }
    return categories.map((name) => ({
      name,
      expenseCount: counts.get(name) ?? 0,
    }));
  }

  async replace(userId: string, categories: string[]): Promise<string[]> {
    const unique = [...new Set(categories.map((c) => c.trim()).filter(Boolean))];
    if (unique.length === 0) throw new HttpError(400, 'Informe ao menos uma categoria');
    const existing = await this.ensureDefaults(userId);
    const file: CategoriesFile = {
      categories: unique,
      updatedAt: new Date().toISOString(),
      version: existing.version + 1,
    };
    await putJson(this.env.APPLICATIONS, this.key(userId), file);
    return file.categories;
  }

  async add(userId: string, name: string): Promise<CategoryWithUsage[]> {
    const existing = await this.ensureDefaults(userId);
    const trimmed = name.trim();
    if (!trimmed) throw new HttpError(400, 'Informe o nome da categoria');
    if (existing.categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      throw new HttpError(409, 'Já existe uma categoria com esse nome');
    }
    await this.replace(userId, [...existing.categories, trimmed]);
    return this.listWithUsage(userId);
  }

  async rename(userId: string, from: string, to: string): Promise<CategoryWithUsage[]> {
    const fromName = from.trim();
    const toName = to.trim();
    if (!fromName || !toName) throw new HttpError(400, 'Informe os nomes da categoria');

    const existing = await this.ensureDefaults(userId);
    const index = existing.categories.findIndex(
      (c) => c.toLowerCase() === fromName.toLowerCase(),
    );
    if (index < 0) throw new HttpError(404, 'Categoria não encontrada');
    const currentName = existing.categories[index];

    if (
      currentName.toLowerCase() !== toName.toLowerCase() &&
      existing.categories.some((c) => c.toLowerCase() === toName.toLowerCase())
    ) {
      throw new HttpError(409, 'Já existe uma categoria com esse nome');
    }

    const next = [...existing.categories];
    next[index] = toName;
    await this.replace(userId, next);

    if (currentName !== toName) {
      await this.renameExpenses(userId, currentName, toName);
    }

    return this.listWithUsage(userId);
  }

  async remove(userId: string, name: string): Promise<CategoryWithUsage[]> {
    const trimmed = name.trim();
    const existing = await this.ensureDefaults(userId);
    const found = existing.categories.find((c) => c.toLowerCase() === trimmed.toLowerCase());
    if (!found) throw new HttpError(404, 'Categoria não encontrada');

    const usage = await this.countUsage(userId, found);
    if (usage > 0) {
      throw new HttpError(
        409,
        `Não é possível excluir: existem ${usage} gasto(s) vinculado(s) a esta categoria`,
      );
    }

    if (existing.categories.length <= 1) {
      throw new HttpError(400, 'É necessário manter ao menos uma categoria');
    }

    await this.replace(
      userId,
      existing.categories.filter((c) => c.toLowerCase() !== found.toLowerCase()),
    );
    return this.listWithUsage(userId);
  }

  private async countUsage(userId: string, category: string): Promise<number> {
    const expenses = await listJsonUnderPrefix<Expense>(
      this.env.APPLICATIONS,
      expensePrefix(r2Prefix(this.env), userId),
    );
    return expenses.filter((e) => e.category === category).length;
  }

  private async renameExpenses(userId: string, from: string, to: string): Promise<void> {
    const prefix = expensePrefix(r2Prefix(this.env), userId);
    const expenses = await listJsonUnderPrefix<Expense>(this.env.APPLICATIONS, prefix);
    const now = new Date().toISOString();
    for (const expense of expenses) {
      if (expense.category !== from) continue;
      const updated: Expense = {
        ...expense,
        category: to,
        updatedAt: now,
        version: expense.version + 1,
      };
      await putJson(
        this.env.APPLICATIONS,
        `${prefix}${expense.id}.json`,
        updated,
      );
    }
  }
}
