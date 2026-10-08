import { describe, expect, it } from 'vitest';
import { calculateIncomeTax, getIncomeTaxRate } from '../src/services/tax/incomeTax';
import { calculateIOF, getIofRate } from '../src/services/tax/iof';
import { calculateContributionPerformance, splitYield } from '../src/services/yieldService';
import { todayIso } from '../src/utils/dates';

describe('IR regressivo', () => {
  it('usa as faixas oficiais', () => {
    expect(getIncomeTaxRate(1)).toBe(0.225);
    expect(getIncomeTaxRate(180)).toBe(0.225);
    expect(getIncomeTaxRate(181)).toBe(0.2);
    expect(getIncomeTaxRate(360)).toBe(0.2);
    expect(getIncomeTaxRate(361)).toBe(0.175);
    expect(getIncomeTaxRate(720)).toBe(0.175);
    expect(getIncomeTaxRate(721)).toBe(0.15);
  });

  it('incide sobre o rendimento', () => {
    expect(calculateIncomeTax(100, 100)).toBeCloseTo(22.5);
    expect(calculateIncomeTax(200, 100)).toBeCloseTo(20);
  });
});

describe('IOF', () => {
  it('zera a partir do 30º dia', () => {
    expect(getIofRate(1)).toBe(0.96);
    expect(getIofRate(29)).toBe(0.03);
    expect(getIofRate(30)).toBe(0);
    expect(calculateIOF(10, 100)).toBeCloseTo(66);
    expect(calculateIOF(30, 100)).toBe(0);
  });
});

describe('rendimento por aporte', () => {
  it('aplica CDI diário e impostos por aporte', () => {
    const rates = new Map<string, number>([
      ['2026-08-01', 0.0005],
      ['2026-08-02', 0.0005],
      ['2026-08-03', 0.0005],
    ]);
    const result = calculateContributionPerformance(
      { amount: 1000, date: '2026-08-01', cdiPercent: 100 },
      rates,
      '2026-08-04',
    );
    // fator = (1.0005)^3
    const expectedGross = 1000 * 1.0005 ** 3 - 1000;
    expect(result.grossYield).toBeCloseTo(expectedGross, 2);
    expect(result.principal).toBe(1000);
    expect(result.daysHeld).toBe(3);
    expect(result.iof).toBeGreaterThan(0);
    expect(result.incomeTax).toBeGreaterThan(0);
    expect(result.netRedemptionValue).toBeLessThan(result.currentValue);
  });

  it('respeita percentual do CDI', () => {
    const rates = new Map<string, number>([['2026-08-01', 0.001]]);
    const full = calculateContributionPerformance(
      { amount: 1000, date: '2026-08-01', cdiPercent: 100 },
      rates,
      '2026-08-02',
    );
    const half = calculateContributionPerformance(
      { amount: 1000, date: '2026-08-01', cdiPercent: 50 },
      rates,
      '2026-08-02',
    );
    expect(half.grossYield).toBeCloseTo(full.grossYield / 2, 4);
  });

  it('projeta CDI em dias úteis futuros sem taxa publicada, só em simulação', () => {
    // última taxa sexta 07/08; simula resgate na quarta 12/08
    const rates = new Map<string, number>([['2026-08-07', 0.0005]]);
    const result = calculateContributionPerformance(
      { amount: 100, date: '2026-08-07', cdiPercent: 100 },
      rates,
      '2026-08-12',
      { projectUnpublished: true },
    );
    // dias no intervalo [07, 12): 07(sex usa 0.0005), 08(sab skip), 09(dom skip),
    // 10(seg proj), 11(ter proj) => 3 fatores
    const expectedGross = 100 * 1.0005 ** 3 - 100;
    expect(result.projectedBusinessDays).toBe(2);
    expect(result.grossYield).toBeCloseTo(expectedGross, 2);
    expect(result.netRedemptionValue).toBeGreaterThan(100);
  });

  it('não rende enquanto a taxa do dia não foi publicada (aporte de R$ 700)', () => {
    // Última taxa publicada: 06/10. Aporte em 07/10, consultado em 08/10.
    const rates = new Map<string, number>([['2026-10-06', 0.00051]]);
    const result = calculateContributionPerformance(
      { amount: 700, date: '2026-10-07', cdiPercent: 100 },
      rates,
      '2026-10-08',
    );
    expect(result.projectedBusinessDays).toBe(0);
    expect(result.grossYield).toBe(0);
    expect(result.iof).toBe(0);
    expect(result.incomeTax).toBe(0);
    expect(result.netYield).toBe(0);
    expect(result.netRedemptionValue).toBe(700);
  });

  it('rende a partir da publicação da taxa do dia do aporte', () => {
    const rates = new Map<string, number>([['2026-10-07', 0.00051]]);
    const result = calculateContributionPerformance(
      { amount: 700, date: '2026-10-07', cdiPercent: 100 },
      rates,
      '2026-10-08',
    );
    // 700 * 0,00051 = 0,357 → bruto 0,36; IOF 96% = 0,343 → 0,34; IR 22,5% de 0,014 → 0,00
    expect(result.grossYield).toBe(0.36);
    expect(result.iof).toBe(0.34);
    expect(result.incomeTax).toBe(0);
    expect(result.netYield).toBe(0.02);
    expect(result.netRedemptionValue).toBe(700.02);
  });

  it('bruto − IOF − IR fecha com o líquido em centavos', () => {
    const rates = new Map<string, number>();
    for (let d = 1; d <= 28; d++) {
      rates.set(`2026-08-${String(d).padStart(2, '0')}`, 0.000537);
    }
    for (const amount of [0.5, 13.37, 700, 1234.56, 99999.99]) {
      for (const asOf of ['2026-08-02', '2026-08-05', '2026-08-15', '2026-08-29']) {
        const r = calculateContributionPerformance(
          { amount, date: '2026-08-01', cdiPercent: 103 },
          rates,
          asOf,
        );
        const cents = (v: number) => Math.round(v * 100);
        expect(cents(r.grossYield) - cents(r.iof) - cents(r.incomeTax)).toBe(cents(r.netYield));
        expect(r.netYield).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('splitYield', () => {
  it('arredonda cada parcela pelo valor exato e deriva o líquido', () => {
    expect(splitYield(0.357, 1)).toEqual({
      grossYield: 0.36,
      iof: 0.34,
      incomeTax: 0,
      netYield: 0.02,
    });
  });

  it('nunca deixa os impostos passarem do rendimento', () => {
    const r = splitYield(0.005, 1);
    expect(r.grossYield).toBe(0.01);
    expect(r.iof + r.incomeTax).toBeLessThanOrEqual(r.grossYield);
    expect(r.netYield).toBeGreaterThanOrEqual(0);
  });
});

describe('todayIso', () => {
  it('usa o horário de Brasília, não UTC', () => {
    // 07/10 às 22h46 em Brasília = 08/10 01h46 UTC
    expect(todayIso(new Date('2026-10-08T01:46:00Z'))).toBe('2026-10-07');
    expect(todayIso(new Date('2026-10-08T03:00:00Z'))).toBe('2026-10-08');
  });
});
