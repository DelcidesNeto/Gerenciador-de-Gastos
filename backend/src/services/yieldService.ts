import { daysBetween, todayIso } from '../utils/dates';
import { roundMoney } from '../utils/money';
import { calculateIncomeTax, getIncomeTaxRate } from './tax/incomeTax';
import { calculateIOF, getIofRate } from './tax/iof';

export type ContributionYieldInput = {
  amount: number;
  date: string;
  cdiPercent: number;
};

export type ContributionPerformance = {
  principal: number;
  startDate: string;
  asOfDate: string;
  daysHeld: number;
  cdiPercent: number;
  grossYield: number;
  iof: number;
  iofRate: number;
  incomeTax: number;
  incomeTaxRate: number;
  netYield: number;
  currentValue: number;
  netRedemptionValue: number;
  /** Quantos dias úteis usaram projeção da última taxa CDI conhecida. */
  projectedBusinessDays: number;
  lastKnownCdiDate: string | null;
};

/**
 * Calcula rendimento de um aporte com base nas taxas DI diárias.
 *
 * Metodologia:
 * 1. Para cada dia civil no intervalo [aporte, dataRef):
 *    - se houver taxa DI publicada, aplica fator = 1 + di * (cdiPercent/100);
 *    - se a data for posterior à última publicação e for dia útil (seg–sex),
 *      projeta com a última taxa conhecida (necessário para simulações futuras).
 * 2. Valor bruto = principal * produto(fatores).
 * 3. Rendimento bruto = valor bruto − principal.
 * 4. IOF sobre rendimento (se < 30 dias).
 * 5. IR sobre (rendimento bruto − IOF), tabela regressiva.
 * 6. Líquido = principal + rendimento − IOF − IR.
 *
 * Finais de semana / feriados históricos sem publicação não alteram o fator.
 */
export function calculateContributionPerformance(
  input: ContributionYieldInput,
  rateByDate: Map<string, number>,
  asOfDate: string,
): ContributionPerformance {
  if (asOfDate < input.date) {
    throw new Error('Data de referência não pode ser anterior ao aporte');
  }

  const lastKnown = findLastKnownRate(rateByDate, asOfDate);
  let factor = 1;
  let projectedBusinessDays = 0;
  const start = new Date(`${input.date}T00:00:00.000Z`);
  const end = new Date(`${asOfDate}T00:00:00.000Z`);
  const pct = input.cdiPercent / 100;

  for (let t = start.getTime(); t < end.getTime(); t += 86_400_000) {
    const iso = new Date(t).toISOString().slice(0, 10);
    const published = rateByDate.get(iso);
    if (published != null && Number.isFinite(published)) {
      factor *= 1 + published * pct;
      continue;
    }

    // Projeção só para dias úteis após a última taxa conhecida (simulação futura).
    if (lastKnown && iso > lastKnown.date && isWeekday(iso)) {
      factor *= 1 + lastKnown.rate * pct;
      projectedBusinessDays += 1;
    }
  }

  const daysHeld = daysBetween(input.date, asOfDate);
  const grossValue = input.amount * factor;
  const grossYield = Math.max(0, grossValue - input.amount);
  const iof = calculateIOF(daysHeld, grossYield);
  const taxable = Math.max(0, grossYield - iof);
  const incomeTax = calculateIncomeTax(daysHeld, taxable);
  const netYield = grossYield - iof - incomeTax;
  const netRedemptionValue = input.amount + netYield;

  return {
    principal: roundMoney(input.amount),
    startDate: input.date,
    asOfDate,
    daysHeld,
    cdiPercent: input.cdiPercent,
    grossYield: roundMoney(grossYield),
    iof: roundMoney(iof),
    iofRate: getIofRate(daysHeld),
    incomeTax: roundMoney(incomeTax),
    incomeTaxRate: getIncomeTaxRate(daysHeld),
    netYield: roundMoney(netYield),
    currentValue: roundMoney(input.amount + grossYield),
    netRedemptionValue: roundMoney(netRedemptionValue),
    projectedBusinessDays,
    lastKnownCdiDate: lastKnown?.date ?? null,
  };
}

function isWeekday(iso: string): boolean {
  const day = new Date(`${iso}T00:00:00.000Z`).getUTCDay();
  return day >= 1 && day <= 5;
}

function findLastKnownRate(
  rateByDate: Map<string, number>,
  uptoDate: string,
): { date: string; rate: number } | null {
  let best: { date: string; rate: number } | null = null;
  for (const [date, rate] of rateByDate) {
    if (date > uptoDate) continue;
    if (!Number.isFinite(rate)) continue;
    if (!best || date > best.date) best = { date, rate };
  }
  // Se não houver taxa até asOfDate (ex.: simulação toda no futuro), usa a última geral.
  if (!best) {
    for (const [date, rate] of rateByDate) {
      if (!Number.isFinite(rate)) continue;
      if (!best || date > best.date) best = { date, rate };
    }
  }
  return best;
}

/** Expõe todayIso para testes/callers que queiram ancorar projeção. */
export { todayIso };
