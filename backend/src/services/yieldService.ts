import { daysBetween } from '../utils/dates';
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

export type PerformanceOptions = {
  /**
   * Projeta dias úteis sem taxa publicada com a última taxa conhecida.
   * Só faz sentido em simulação de data futura; no saldo atual, dia sem taxa
   * publicada ainda não rendeu.
   */
  projectUnpublished?: boolean;
};

/**
 * Calcula rendimento de um aporte com base nas taxas DI diárias.
 *
 * Metodologia:
 * 1. Para cada dia civil no intervalo [aporte, dataRef):
 *    - se houver taxa DI publicada, aplica fator = 1 + di * (cdiPercent/100);
 *    - com `projectUnpublished`, dias úteis após a última publicação usam a
 *      última taxa conhecida.
 * 2. Rendimento bruto = principal * produto(fatores) − principal.
 * 3. IOF sobre rendimento (se < 30 dias).
 * 4. IR sobre (rendimento bruto − IOF), tabela regressiva.
 * 5. Líquido = bruto − IOF − IR, fechado em centavos (ver `splitYield`).
 *
 * Finais de semana / feriados históricos sem publicação não alteram o fator.
 */
export function calculateContributionPerformance(
  input: ContributionYieldInput,
  rateByDate: Map<string, number>,
  asOfDate: string,
  options: PerformanceOptions = {},
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

    if (
      options.projectUnpublished &&
      lastKnown &&
      iso > lastKnown.date &&
      isWeekday(iso)
    ) {
      factor *= 1 + lastKnown.rate * pct;
      projectedBusinessDays += 1;
    }
  }

  const daysHeld = daysBetween(input.date, asOfDate);
  const yields = splitYield(Math.max(0, input.amount * factor - input.amount), daysHeld);

  return {
    principal: roundMoney(input.amount),
    startDate: input.date,
    asOfDate,
    daysHeld,
    cdiPercent: input.cdiPercent,
    grossYield: yields.grossYield,
    iof: yields.iof,
    iofRate: getIofRate(daysHeld),
    incomeTax: yields.incomeTax,
    incomeTaxRate: getIncomeTaxRate(daysHeld),
    netYield: yields.netYield,
    currentValue: roundMoney(input.amount + yields.grossYield),
    netRedemptionValue: roundMoney(input.amount + yields.netYield),
    projectedBusinessDays,
    lastKnownCdiDate: lastKnown?.date ?? null,
  };
}

/**
 * Converte o rendimento exato em centavos. Bruto, IOF e IR são arredondados a
 * partir do valor exato; o líquido sai por subtração, para que
 * bruto − IOF − IR = líquido sempre feche nos valores exibidos.
 */
export function splitYield(grossYieldExact: number, daysHeld: number) {
  const iofExact = calculateIOF(daysHeld, grossYieldExact);
  const incomeTaxExact = calculateIncomeTax(daysHeld, Math.max(0, grossYieldExact - iofExact));

  const grossCents = toCents(grossYieldExact);
  const iofCents = Math.min(toCents(iofExact), grossCents);
  const incomeTaxCents = Math.min(toCents(incomeTaxExact), grossCents - iofCents);
  const netCents = grossCents - iofCents - incomeTaxCents;

  return {
    grossYield: grossCents / 100,
    iof: iofCents / 100,
    incomeTax: incomeTaxCents / 100,
    netYield: netCents / 100,
  };
}

function toCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100);
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
