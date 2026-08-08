/** Arredonda half-up para N casas (padrão 2 — reais). */
export function roundMoney(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function assertPositiveAmount(value: number, field = 'amount'): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${field} deve ser um número positivo`);
  }
}
