import { apiRequest } from './apiClient';

export type Expense = {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string;
  paymentMethod: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type ExpenseInput = {
  description: string;
  amount: number;
  date: string;
  category: string;
  paymentMethod: string;
  notes?: string;
};

export async function listExpenses(params?: { from?: string; to?: string; category?: string }) {
  const qs = new URLSearchParams();
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  if (params?.category) qs.set('category', params.category);
  const q = qs.toString();
  return apiRequest<{ items: Expense[] }>(`/expenses${q ? `?${q}` : ''}`);
}

export async function createExpense(input: ExpenseInput) {
  return apiRequest<{ item: Expense }>('/expenses', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateExpense(id: string, input: Partial<ExpenseInput>) {
  return apiRequest<{ item: Expense }>(`/expenses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteExpense(id: string) {
  return apiRequest<{ ok: boolean }>(`/expenses/${id}`, { method: 'DELETE' });
}

export async function expenseSummary(month: string) {
  return apiRequest<{
    month: string;
    total: number;
    byCategory: Record<string, number>;
    count: number;
  }>(`/expenses/summary?month=${encodeURIComponent(month)}`);
}

export async function expensesByPeriod(from: string, to: string) {
  return apiRequest<{
    from: string;
    to: string;
    total: number;
    byCategory: Record<string, number>;
    byMonth: Record<string, number>;
    count: number;
    items: Expense[];
  }>(`/expenses/by-period?from=${from}&to=${to}`);
}

export async function compareMonths(months: string[]) {
  return apiRequest<{ months: Array<{ month: string; total: number }> }>(
    `/expenses/compare?months=${months.join(',')}`,
  );
}

export type CategoryWithUsage = {
  name: string;
  expenseCount: number;
};

export async function listCategories() {
  const res = await apiRequest<{ categories: CategoryWithUsage[] | string[] }>('/categories');
  const names = res.categories.map((c) => (typeof c === 'string' ? c : c.name));
  return { categories: names };
}

export async function listCategoriesWithUsage() {
  return apiRequest<{ categories: CategoryWithUsage[] }>('/categories');
}

export async function addCategory(name: string) {
  return apiRequest<{ categories: CategoryWithUsage[] }>('/categories', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function renameCategory(from: string, to: string) {
  return apiRequest<{ categories: CategoryWithUsage[] }>('/categories/rename', {
    method: 'PUT',
    body: JSON.stringify({ from, to }),
  });
}

export async function deleteCategory(name: string) {
  return apiRequest<{ categories: CategoryWithUsage[] }>('/categories', {
    method: 'DELETE',
    body: JSON.stringify({ name }),
  });
}
