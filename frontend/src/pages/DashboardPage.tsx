import { useEffect, useState } from 'react';
import { CategoryPieChart, EvolutionLineChart, MonthlyBarChart } from '../components/Charts';
import { KpiCard } from '../components/KpiCard';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/apiClient';
import { compareMonths, expenseSummary } from '../services/expenseService';
import { investmentsSummary } from '../services/investmentService';
import { currentMonth, formatMonth, lastNMonths } from '../utils/format';

export function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [monthTotal, setMonthTotal] = useState(0);
  const [byCategory, setByCategory] = useState<Record<string, number>>({});
  const [monthBars, setMonthBars] = useState<Array<{ month: string; total: number }>>([]);
  const [invested, setInvested] = useState(0);
  const [netYield, setNetYield] = useState(0);
  const [currentValue, setCurrentValue] = useState(0);

  useEffect(() => {
    const month = currentMonth();
    const months = lastNMonths(6, month);
    setLoading(true);
    Promise.all([
      expenseSummary(month),
      compareMonths(months),
      investmentsSummary().catch(() => null),
    ])
      .then(([summary, compare, inv]) => {
        setMonthTotal(summary.total);
        setByCategory(summary.byCategory);
        setMonthBars(compare.months);
        if (inv) {
          setInvested(inv.summary.totalInvested);
          setNetYield(inv.summary.netYield);
          setCurrentValue(inv.summary.currentValue);
        }
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Erro ao carregar o painel');
      })
      .finally(() => setLoading(false));
  }, []);

  const patrimonio = currentValue; // investimentos a valor atual; gastos não entram como patrimônio
  const evolution = monthBars.map((m) => ({
    label: formatMonth(m.month).split('/')[0].slice(0, 3),
    value: m.total,
  }));

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <h1>Olá, {user?.name}</h1>
          <p>Resumo financeiro de {formatMonth(currentMonth())}.</p>
        </div>
      </header>

      {error ? <div className="alert">{error}</div> : null}
      {loading ? <p className="muted">Carregando...</p> : null}

      <div className="grid-kpi">
        <KpiCard label="Patrimônio investido" value={patrimonio} hint="Valor atual dos aportes" />
        <KpiCard label="Gastos do mês" value={monthTotal} tone="negative" />
        <KpiCard label="Total investido" value={invested} />
        <KpiCard
          label="Rendimento líquido"
          value={netYield}
          tone={netYield >= 0 ? 'positive' : 'negative'}
          hint="Após IOF e IR estimados"
        />
      </div>

      <div className="grid-2">
        <section className="panel">
          <h2>Gastos por categoria</h2>
          <CategoryPieChart data={byCategory} />
        </section>
        <section className="panel">
          <h2>Comparação entre meses</h2>
          <MonthlyBarChart data={monthBars} />
        </section>
      </div>

      <section className="panel">
        <h2>Gastos ao longo do tempo</h2>
        <EvolutionLineChart data={evolution} name="Gastos" />
      </section>
    </div>
  );
}
