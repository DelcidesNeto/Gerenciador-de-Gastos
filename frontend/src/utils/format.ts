export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatPercent(rate: number): string {
  return `${(rate * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function formatMonth(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-');
  const names = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];
  return `${names[Number(m) - 1]}/${y}`;
}

export function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function currentMonth(): string {
  return todayIso().slice(0, 7);
}

export function lastNMonths(n: number, from = currentMonth()): string[] {
  const [y, m] = from.split('-').map(Number);
  const out: string[] = [];
  let year = y;
  let month = m;
  for (let i = 0; i < n; i++) {
    out.unshift(`${year}-${String(month).padStart(2, '0')}`);
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  return out;
}
