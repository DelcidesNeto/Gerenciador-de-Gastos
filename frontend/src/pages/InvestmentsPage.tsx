import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { KpiCard } from '../components/KpiCard';
import { ApiError } from '../services/apiClient';
import {
  createInvestment,
  deleteInvestment,
  getCdiStatus,
  investmentsSummary,
  listInvestments,
  updateInvestment,
  type Investment,
  type SummaryTotals,
} from '../services/investmentService';
import { formatCurrency, formatDate, formatPercent, todayIso } from '../utils/format';

export function InvestmentsPage() {
  const [items, setItems] = useState<Investment[]>([]);
  const [summary, setSummary] = useState<SummaryTotals | null>(null);
  const [cdiInfo, setCdiInfo] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [cdiPercent, setCdiPercent] = useState(100);
  const [firstAmount, setFirstAmount] = useState(0);
  const [firstDate, setFirstDate] = useState(todayIso());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const [list, sum, cdi] = await Promise.all([
        listInvestments(),
        investmentsSummary(),
        getCdiStatus().catch(() => null),
      ]);
      setItems(list.items);
      setSummary(sum.summary);
      if (cdi?.lastRate) {
        setCdiInfo(
          `CDI (BCB série ${cdi.seriesCode}) em ${formatDate(cdi.lastRate.date)}: ${formatPercent(cdi.lastRate.rate)} a.d.`,
        );
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar investimentos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function resetForm() {
    setEditingId(null);
    setName('');
    setCdiPercent(100);
    setFirstAmount(0);
    setFirstDate(todayIso());
  }

  function startEdit(item: Investment) {
    setEditingId(item.id);
    setName(item.name);
    setCdiPercent(item.cdiPercent);
    document.getElementById('investment-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        await updateInvestment(editingId, { name, cdiPercent });
      } else {
        await createInvestment({
          name,
          cdiPercent,
          contributions:
            firstAmount > 0 ? [{ amount: Number(firstAmount), date: firstDate }] : [],
        });
      }
      resetForm();
      await refresh();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : editingId
            ? 'Erro ao salvar investimento'
            : 'Erro ao criar investimento',
      );
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Excluir este investimento e todos os aportes?')) return;
    try {
      await deleteInvestment(id);
      if (editingId === id) resetForm();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir');
    }
  }

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <h1>Investimentos</h1>
          <p>Aportes individuais atrelados ao CDI, com rendimento bruto e líquido.</p>
          {cdiInfo ? <p className="muted">{cdiInfo}</p> : null}
        </div>
      </header>

      {error ? <div className="alert">{error}</div> : null}

      {summary ? (
        <div className="grid-kpi">
          <KpiCard label="Total investido" value={summary.totalInvested} />
          <KpiCard label="Rendimento bruto" value={summary.grossYield} tone="positive" />
          <KpiCard label="Impostos (IOF + IR)" value={summary.taxes} />
          <KpiCard label="Valor líquido estimado" value={summary.netRedemptionValue} />
        </div>
      ) : null}

      <section className="panel" id="investment-form">
        <h2>{editingId ? 'Editar investimento' : 'Novo investimento'}</h2>
        <form className="stack" onSubmit={(e) => void onSubmit(e)} style={{ marginTop: '1rem' }}>
          <div className="form-grid">
            <div className="field">
              <label>Nome</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="CDB 100% CDI"
              />
            </div>
            <div className="field">
              <label>% do CDI</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={cdiPercent}
                onChange={(e) => setCdiPercent(Number(e.target.value))}
              />
            </div>
            {!editingId ? (
              <>
                <div className="field">
                  <label>Primeiro aporte (opcional)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={firstAmount || ''}
                    onChange={(e) => setFirstAmount(Number(e.target.value))}
                  />
                </div>
                <div className="field">
                  <label>Data do aporte</label>
                  <input
                    type="date"
                    value={firstDate}
                    onChange={(e) => setFirstDate(e.target.value)}
                  />
                </div>
              </>
            ) : null}
          </div>
          <div className="row">
            <button className="btn" type="submit" disabled={saving}>
              {saving
                ? 'Salvando...'
                : editingId
                  ? 'Salvar alterações'
                  : 'Criar investimento'}
            </button>
            {editingId ? (
              <button className="btn btn-secondary" type="button" onClick={resetForm}>
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="panel">
        <h2>Seus investimentos</h2>
        {loading ? <p className="muted">Carregando...</p> : null}
        {!loading && items.length === 0 ? (
          <div className="empty">Nenhum investimento cadastrado.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>% CDI</th>
                  <th>Aportes</th>
                  <th>Principal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const principal = item.contributions.reduce((s, c) => s + c.amount, 0);
                  return (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{item.cdiPercent}%</td>
                      <td>{item.contributions.length}</td>
                      <td>{formatCurrency(principal)}</td>
                      <td>
                        <div className="table-actions">
                          <Link className="btn btn-secondary btn-sm" to={`/investimentos/${item.id}`}>
                            Detalhes
                          </Link>
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
