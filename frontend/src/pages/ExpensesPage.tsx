import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CategoryPieChart } from '../components/Charts';
import { ApiError } from '../services/apiClient';
import {
  createExpense,
  deleteExpense,
  expensesByPeriod,
  listCategories,
  listExpenses,
  updateExpense,
  type Expense,
  type ExpenseInput,
} from '../services/expenseService';
import { currentMonth, formatCurrency, formatDate, todayIso } from '../utils/format';

const PAYMENT_METHODS = [
  'Cartão de crédito',
  'Cartão de débito',
  'Pix',
  'Dinheiro',
  'Boleto',
  'Transferência',
];

const emptyForm: ExpenseInput = {
  description: '',
  amount: 0,
  date: todayIso(),
  category: 'Alimentação',
  paymentMethod: 'Pix',
  notes: '',
};

export function ExpensesPage() {
  const [items, setItems] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [from, setFrom] = useState(`${currentMonth()}-01`);
  const [to, setTo] = useState(todayIso());
  const [categoryFilter, setCategoryFilter] = useState('');
  const [summary, setSummary] = useState<{ total: number; byCategory: Record<string, number> }>({
    total: 0,
    byCategory: {},
  });
  const [form, setForm] = useState<ExpenseInput>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const periodFrom = from <= to ? from : to;
      const periodTo = from <= to ? to : from;
      const [list, cats, period] = await Promise.all([
        listExpenses({
          from: periodFrom,
          to: periodTo,
          category: categoryFilter || undefined,
        }),
        listCategories(),
        expensesByPeriod(periodFrom, periodTo),
      ]);
      setItems(list.items);
      setCategories(cats.categories);

      const byCategory = categoryFilter
        ? Object.fromEntries(
            Object.entries(period.byCategory).filter(([cat]) => cat === categoryFilter),
          )
        : period.byCategory;
      const total = categoryFilter
        ? list.items.reduce((s, i) => s + i.amount, 0)
        : period.total;

      setSummary({ total, byCategory });
      setForm((f) => ({
        ...f,
        category: f.category || cats.categories[0] || 'Outros',
      }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar gastos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, categoryFilter]);

  const periodLabel = useMemo(() => {
    const a = from <= to ? from : to;
    const b = from <= to ? to : from;
    return `${formatDate(a)} a ${formatDate(b)}`;
  }, [from, to]);

  const totalPeriodo = useMemo(
    () => items.reduce((s, i) => s + i.amount, 0),
    [items],
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, amount: Number(form.amount), notes: form.notes || '' };
      if (editingId) await updateExpense(editingId, payload);
      else await createExpense(payload);
      setForm({ ...emptyForm, category: categories[0] || 'Outros' });
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar gasto');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(item: Expense) {
    setEditingId(item.id);
    setForm({
      description: item.description,
      amount: item.amount,
      date: item.date,
      category: item.category,
      paymentMethod: item.paymentMethod,
      notes: item.notes,
    });
    document.getElementById('expense-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function onDelete(id: string) {
    if (!confirm('Excluir este gasto?')) return;
    try {
      await deleteExpense(id);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir');
    }
  }

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <h1>Gastos</h1>
          <p>
            Cadastre, filtre e acompanhe seus gastos por período e categoria. Para criar ou
            editar categorias, use a tela Categorias.
          </p>
        </div>
      </header>

      {error ? <div className="alert">{error}</div> : null}

      <section className="panel" id="expense-form">
        <h2>{editingId ? 'Editar gasto' : 'Novo gasto'}</h2>
        <form className="stack" onSubmit={(e) => void onSubmit(e)} style={{ marginTop: '1rem' }}>
          <div className="form-grid">
            <div className="field">
              <label>Descrição</label>
              <input
                required
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Valor</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={form.amount || ''}
                onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
              />
            </div>
            <div className="field">
              <label>Data</label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Categoria</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Forma de pagamento</label>
              <select
                value={form.paymentMethod}
                onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
              >
                {PAYMENT_METHODS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Observação</label>
              <input
                value={form.notes || ''}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <div className="row">
            <button className="btn" type="submit" disabled={saving}>
              {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Adicionar gasto'}
            </button>
            {editingId ? (
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm({ ...emptyForm, category: categories[0] || 'Outros' });
                }}
              >
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="panel">
        <h2>Filtros</h2>
        <div className="form-grid" style={{ marginTop: '0.8rem' }}>
          <div className="field">
            <label>De</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field">
            <label>Até</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="field">
            <label>Categoria</label>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">Todas</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <div className="grid-2">
        <section className="panel">
          <h2>Resumo — {periodLabel}</h2>
          <p className="kpi-value" style={{ marginTop: '0.75rem' }}>
            {formatCurrency(summary.total)}
          </p>
          <ul style={{ marginTop: '1rem', paddingLeft: '1.1rem' }}>
            {Object.entries(summary.byCategory).map(([cat, val]) => (
              <li key={cat}>
                {cat}: {formatCurrency(val)}
              </li>
            ))}
          </ul>
        </section>
        <section className="panel">
          <h2>Por categoria no período</h2>
          <CategoryPieChart data={summary.byCategory} />
        </section>
      </div>

      <section className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>Lançamentos do período</h2>
          <span className="badge">Total: {formatCurrency(totalPeriodo)}</span>
        </div>
        {loading ? <p className="muted">Carregando...</p> : null}
        {!loading && items.length === 0 ? (
          <div className="empty">Nenhum gasto encontrado neste período.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Pagamento</th>
                  <th>Valor</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.date)}</td>
                    <td>{item.description}</td>
                    <td>{item.category}</td>
                    <td>{item.paymentMethod}</td>
                    <td>{formatCurrency(item.amount)}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="btn btn-secondary btn-sm"
                          type="button"
                          onClick={() => startEdit(item)}
                        >
                          Editar
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          type="button"
                          onClick={() => void onDelete(item.id)}
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
