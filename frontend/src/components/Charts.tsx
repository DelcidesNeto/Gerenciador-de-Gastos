import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCurrency, formatMonth } from '../utils/format';

const COLORS = ['#0f6b4c', '#1d9a6c', '#3ecf97', '#78a890', '#c4a35a', '#b42318', '#2f6fed', '#8b5cf6'];

type CategoryChartProps = {
  data: Record<string, number>;
};

export function CategoryPieChart({ data }: CategoryChartProps) {
  const rows = Object.entries(data).map(([name, value]) => ({ name, value }));
  if (rows.length === 0) return <div className="empty">Sem dados para o gráfico</div>;

  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={rows} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
            {rows.map((_, i) => (
              <Cell key={rows[i].name} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => formatCurrency(Number(v ?? 0))} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

type MonthBarsProps = {
  data: Array<{ month: string; total: number }>;
};

export function MonthlyBarChart({ data }: MonthBarsProps) {
  const rows = data.map((d) => ({ ...d, label: formatMonth(d.month) }));
  if (rows.length === 0) return <div className="empty">Sem dados para o gráfico</div>;
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={40} />
          <Tooltip formatter={(v) => formatCurrency(Number(v ?? 0))} />
          <Bar dataKey="total" fill="#0f6b4c" radius={[8, 8, 0, 0]} name="Total" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type LineProps = {
  data: Array<{ label: string; value: number }>;
  name?: string;
};

export function EvolutionLineChart({ data, name = 'Valor' }: LineProps) {
  if (data.length === 0) return <div className="empty">Sem dados para o gráfico</div>;
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={40} />
          <Tooltip formatter={(v) => formatCurrency(Number(v ?? 0))} />
          <Line type="monotone" dataKey="value" stroke="#1d9a6c" strokeWidth={2.5} dot={false} name={name} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
