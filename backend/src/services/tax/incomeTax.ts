/**
 * Imposto de Renda regressivo sobre rendimento de renda fixa (aplicações de longo prazo).
 * Alíquota incide sobre o rendimento (após IOF, quando aplicável na simulação).
 *
 * Faixas (dias corridos desde o aporte):
 * - até 180 dias: 22,5%
 * - de 181 a 360: 20%
 * - de 361 a 720: 17,5%
 * - acima de 720: 15%
 */
export function getIncomeTaxRate(daysHeld: number): number {
  if (daysHeld <= 180) return 0.225;
  if (daysHeld <= 360) return 0.2;
  if (daysHeld <= 720) return 0.175;
  return 0.15;
}

export function calculateIncomeTax(daysHeld: number, taxableYield: number): number {
  if (taxableYield <= 0 || daysHeld < 0) return 0;
  const rate = getIncomeTaxRate(daysHeld);
  return taxableYield * rate;
}
