/**
 * IOF regressivo sobre rendimento de aplicações de renda fixa (resgate antecipado).
 * Incide apenas sobre o rendimento, nos primeiros 29 dias (alíquota 0% a partir do 30º dia).
 *
 * Tabela oficial (alíquota sobre o rendimento):
 * dia 1: 96% ... dia 29: 3% ; dia 30+: 0%
 */
const IOF_RATES: Record<number, number> = {
  1: 0.96,
  2: 0.93,
  3: 0.9,
  4: 0.86,
  5: 0.83,
  6: 0.8,
  7: 0.76,
  8: 0.73,
  9: 0.7,
  10: 0.66,
  11: 0.63,
  12: 0.6,
  13: 0.56,
  14: 0.53,
  15: 0.5,
  16: 0.46,
  17: 0.43,
  18: 0.4,
  19: 0.36,
  20: 0.33,
  21: 0.3,
  22: 0.26,
  23: 0.23,
  24: 0.2,
  25: 0.16,
  26: 0.13,
  27: 0.1,
  28: 0.06,
  29: 0.03,
};

export function getIofRate(daysHeld: number): number {
  if (daysHeld <= 0) return IOF_RATES[1];
  if (daysHeld >= 30) return 0;
  return IOF_RATES[daysHeld] ?? 0;
}

export function calculateIOF(daysHeld: number, grossYield: number): number {
  if (grossYield <= 0) return 0;
  const rate = getIofRate(daysHeld);
  return grossYield * rate;
}
