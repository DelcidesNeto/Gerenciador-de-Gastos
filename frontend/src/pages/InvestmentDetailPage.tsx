import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { KpiCard } from '../components/KpiCard';
import { ApiError } from '../services/apiClient';
import {
  addContribution,
  confirmWithdrawal,
  investmentPerformance,
  listWithdrawals,
  removeContribution,
  simulateWithdrawal,
  updateContribution,
  updateInvestment,
  type Contribution,
  type Performance,
  type SummaryTotals,
  type Withdrawal,
  type WithdrawalPreview,
} from '../services/investmentService';
import { formatCurrency, formatDate, formatPercent, todayIso } from '../utils/format';

type ContributionRow = Contribution & { performance: Performance };

export function InvestmentDetailPage() {
  const { id = '' } = useParams();
  const [name, setName] = useState('');
  const [cdiPercent, setCdiPercent] = useState(100);
  const [editName, setEditName] = useState('');
  const [editCdiPercent, setEditCdiPercent] = useState(100);
  const [rows, setRows] = useState<ContributionRow[]>([]);
  const [summary, setSummary] = useState<SummaryTotals | null>(null);
  const [editingContributionId, setEditingContributionId] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(todayIso());
  const [simContributionId, setSimContributionId] = useState('');
  const [simDate, setSimDate] = useState(todayIso());
  const [simAmount, setSimAmount] = useState(0);
  const [simulation, setSimulation] = useState<WithdrawalPreview | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [redeeming, setRedeeming] = useState(false);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const data = await investmentPerformance(id);
      const history = await listWithdrawals(id).catch(() => ({ items: [] as Withdrawal[] }));
      setName(data.investment.name);
      setCdiPercent(data.investment.cdiPercent);
      setEditName(data.investment.name);
      setEditCdiPercent(data.investment.cdiPercent);
      setRows(data.contributions);
      setSummary(data.summary);
      setWithdrawals(history.items);
      const stillExists = data.contributions.some((c) => c.id === simContributionId);
      const nextId = stillExists ? simContributionId : data.contributions[0]?.id ?? '';
      setSimContributionId(nextId);
      const nextContribution = data.contributions.find((c) => c.id === nextId);
      if (nextContribution && (!simAmount || !stillExists)) {
        setSimAmount(nextContribution.amount);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar investimento');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function resetContributionForm() {
    setEditingContributionId(null);
    setAmount(0);
    setDate(todayIso());
  }

  function startEditContribution(row: ContributionRow) {
    setEditingContributionId(row.id);
    setAmount(row.amount);
    setDate(row.date);
    document.getElementById('contribution-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function onSaveMeta(e: FormEvent) {
    e.preventDefault();
    setSavingMeta(true);
    setError('');
    try {
      await updateInvestment(id, { name: editName, cdiPercent: editCdiPercent });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar investimento');
    } finally {
      setSavingMeta(false);
    }
  }

  async function onSubmitContribution(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { amount: Number(amount), date };
      if (editingContributionId) {
        await updateContribution(id, editingContributionId, payload);
      } else {
        await addContribution(id, payload);
      }
      resetContributionForm();
      await refresh();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : editingContributionId
            ? 'Erro ao editar aporte'
            : 'Erro ao adicionar aporte',
      );
    } finally {
      setSaving(false);
    }
  }

  async function onRemove(contributionId: string) {
    if (!confirm('Excluir este aporte?')) return;
    try {
      await removeContribution(id, contributionId);
      if (editingContributionId === contributionId) resetContributionForm();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir aporte');
    }
  }

  async function onSimulate(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const result = await simulateWithdrawal(id, {
        contributionId: simContributionId,
        redemptionDate: simDate,
        amount: Number(simAmount),
      });
      setSimulation(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro na simulação');
    }
  }

  async function onConfirmWithdrawal() {
    if (!simulation) return;
    const remaining = simulation.remainingPrincipal;
    const msg = simulation.fullRedemption
      ? `Confirmar resgate total deste aporte? O IOF e o IR serão descontados do rendimento.`
      : `Confirmar resgate de ${formatCurrency(simulation.investedAmount)}? Restam ${formatCurrency(remaining)} aplicados neste aporte.`;
    if (!confirm(msg)) return;
    setRedeeming(true);
    setError('');
    try {
      await confirmWithdrawal(id, {
        contributionId: simContributionId,
        redemptionDate: simDate,
        amount: Number(simAmount),
      });
      setSimulation(null);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao confirmar o resgate');
    } finally {
      setRedeeming(false);
    }
  }

  function onSelectContribution(contributionId: string) {
    setSimContributionId(contributionId);
    setSimulation(null);
    const row = rows.find((r) => r.id === contributionId);
    if (row) setSimAmount(row.amount);
  }

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <p className="muted">
            <Link to="/investimentos">← Voltar</Link>
          </p>
          <h1>{name || 'Investimento'}</h1>
          <p>{cdiPercent}% do CDI — cada aporte rende de forma independente.</p>
        </div>
      </header>

      {error ? <div className="alert">{error}</div> : null}
      {loading ? <p className="muted">Carregando...</p> : null}

      {summary ? (
        <div className="grid-kpi">
          <KpiCard label="Total investido" value={summary.totalInvested} />
          <KpiCard label="Rendimento bruto" value={summary.grossYield} tone="positive" />
          <KpiCard label="IOF + IR" value={summary.taxes} />
          <KpiCard label="Valor líquido" value={summary.netRedemptionValue} />
        </div>
      ) : null}

      <section className="panel">
        <h2>Editar investimento</h2>
        <form className="row" onSubmit={(e) => void onSaveMeta(e)} style={{ marginTop: '0.8rem' }}>
          <div className="field" style={{ flex: 2, minWidth: 160 }}>
            <label>Nome</label>
            <input required value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 120 }}>
            <label>% do CDI</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              required
              value={editCdiPercent}
              onChange={(e) => setEditCdiPercent(Number(e.target.value))}
            />
          </div>
          <button className="btn" type="submit" disabled={savingMeta} style={{ alignSelf: 'end' }}>
            {savingMeta ? 'Salvando...' : 'Salvar'}
          </button>
        </form>
      </section>

      <section className="panel" id="contribution-form">
        <h2>{editingContributionId ? 'Editar aporte' : 'Novo aporte'}</h2>
        <form
          className="row"
          onSubmit={(e) => void onSubmitContribution(e)}
          style={{ marginTop: '0.8rem' }}
        >
          <div className="field" style={{ flex: 1, minWidth: 140 }}>
            <label>Valor</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              required
              value={amount || ''}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 140 }}>
            <label>Data</label>
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <button className="btn" type="submit" disabled={saving} style={{ alignSelf: 'end' }}>
            {saving
              ? 'Salvando...'
              : editingContributionId
                ? 'Salvar aporte'
                : 'Adicionar'}
          </button>
          {editingContributionId ? (
            <button
              className="btn btn-secondary"
              type="button"
              style={{ alignSelf: 'end' }}
              onClick={resetContributionForm}
            >
              Cancelar
            </button>
          ) : null}
        </form>
      </section>

      <section className="panel">
        <h2>Aportes e rendimento individual</h2>
        {rows.length === 0 ? (
          <div className="empty">Nenhum aporte ainda.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Principal</th>
                  <th>Bruto</th>
                  <th>IOF</th>
                  <th>IR</th>
                  <th>Líquido</th>
                  <th>Valor atual</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.date)}</td>
                    <td>{formatCurrency(row.performance.principal)}</td>
                    <td className="money-pos">{formatCurrency(row.performance.grossYield)}</td>
                    <td>{formatCurrency(row.performance.iof)}</td>
                    <td>{formatCurrency(row.performance.incomeTax)}</td>
                    <td className="money-pos">{formatCurrency(row.performance.netYield)}</td>
                    <td>{formatCurrency(row.performance.currentValue)}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="btn btn-secondary btn-sm"
                          type="button"
                          onClick={() => startEditContribution(row)}
                        >
                          Editar
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          type="button"
                          onClick={() => void onRemove(row.id)}
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

      <section className="panel">
        <h2>Resgatar</h2>
        <p className="muted" style={{ marginTop: '0.35rem' }}>
          Informe quanto do valor aplicado você quer tirar. O rendimento proporcional, IOF e IR
          entram na conta. O que sobrar continua rendendo neste aporte.
        </p>
        {rows.length === 0 ? (
          <div className="empty">Nenhum aporte disponível para resgate.</div>
        ) : (
          <form className="stack" onSubmit={(e) => void onSimulate(e)} style={{ marginTop: '0.8rem' }}>
            <div className="form-grid">
              <div className="field">
                <label>Aporte</label>
                <select
                  required
                  value={simContributionId}
                  onChange={(e) => onSelectContribution(e.target.value)}
                >
                  {rows.map((r) => (
                    <option key={r.id} value={r.id}>
                      {formatDate(r.date)} — {formatCurrency(r.amount)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Valor do principal</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={simAmount || ''}
                  onChange={(e) => {
                    setSimAmount(Number(e.target.value));
                    setSimulation(null);
                  }}
                />
              </div>
              <div className="field">
                <label>Data do resgate</label>
                <input
                  type="date"
                  required
                  value={simDate}
                  onChange={(e) => {
                    setSimDate(e.target.value);
                    setSimulation(null);
                  }}
                />
              </div>
            </div>
            <div className="row">
              <button className="btn btn-secondary" type="submit">
                Calcular impostos
              </button>
            </div>
          </form>
        )}

        {simulation ? (
          <div className="stack" style={{ marginTop: '1.2rem' }}>
            <div className="row">
              <span className="badge">{simulation.daysHeld} dias</span>
              <span className="badge">IOF {formatPercent(simulation.iofRate)}</span>
              <span className="badge">IR {formatPercent(simulation.incomeTaxRate)}</span>
              {simulation.fullRedemption ? (
                <span className="badge">Resgate total</span>
              ) : (
                <span className="badge">
                  Resta {formatCurrency(simulation.remainingPrincipal)}
                </span>
              )}
            </div>
            {simulation.projectedBusinessDays > 0 ? (
              <p className="muted">
                Estimativa: {simulation.projectedBusinessDays} dia(s) útil(eis) projetado(s) com a
                última taxa CDI conhecida
                {simulation.lastKnownCdiDate
                  ? ` (${formatDate(simulation.lastKnownCdiDate)})`
                  : ''}
                , pois o BCB ainda não publicou taxas para todo o período.
              </p>
            ) : null}
            <ul style={{ paddingLeft: '1.1rem', lineHeight: 1.8 }}>
              <li>Principal resgatado: {formatCurrency(simulation.investedAmount)}</li>
              <li>Rendimento bruto: {formatCurrency(simulation.grossYield)}</li>
              <li>IOF: {formatCurrency(simulation.iof)}</li>
              <li>IR: {formatCurrency(simulation.incomeTax)}</li>
              <li>Rendimento líquido: {formatCurrency(simulation.netYield)}</li>
              <li>
                <strong>
                  Você recebe: {formatCurrency(simulation.netRedemptionValue)}
                </strong>
              </li>
            </ul>
            <div className="row">
              <button
                className="btn"
                type="button"
                disabled={redeeming}
                onClick={() => void onConfirmWithdrawal()}
              >
                {redeeming ? 'Confirmando...' : 'Confirmar resgate'}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h2>Histórico de resgates</h2>
        {withdrawals.length === 0 ? (
          <div className="empty">Nenhum resgate registrado ainda.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Principal</th>
                  <th>Rendimento</th>
                  <th>IOF</th>
                  <th>IR</th>
                  <th>Recebido</th>
                  <th>Restante no aporte</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.date)}</td>
                    <td>{formatCurrency(item.principal)}</td>
                    <td className="money-pos">{formatCurrency(item.grossYield)}</td>
                    <td>{formatCurrency(item.iof)}</td>
                    <td>{formatCurrency(item.incomeTax)}</td>
                    <td>{formatCurrency(item.netAmount)}</td>
                    <td>{formatCurrency(item.remainingPrincipal)}</td>
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
