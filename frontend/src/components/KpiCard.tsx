import { formatCurrency } from '../utils/format';

type Props = {
  label: string;
  value: number;
  hint?: string;
  tone?: 'default' | 'positive' | 'negative';
};

export function KpiCard({ label, value, hint, tone = 'default' }: Props) {
  const toneClass =
    tone === 'positive' ? 'money-pos' : tone === 'negative' ? 'money-neg' : undefined;
  return (
    <div className="panel">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${toneClass ?? ''}`}>{formatCurrency(value)}</div>
      {hint ? <div className="muted" style={{ marginTop: '0.35rem', fontSize: '0.88rem' }}>{hint}</div> : null}
    </div>
  );
}
