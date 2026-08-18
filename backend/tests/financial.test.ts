import { describe, expect, it } from 'vitest';
import { calculateIncomeTax, getIncomeTaxRate } from '../src/services/tax/incomeTax';
import { calculateIOF, getIofRate } from '../src/services/tax/iof';
import { calculateContributionPerformance, scalePerformance } from '../src/services/yieldService';

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

  it('projeta CDI em dias úteis futuros sem taxa publicada', () => {
    // última taxa sexta 07/08; simula resgate na quarta 12/08
    const rates = new Map<string, number>([['2026-08-07', 0.0005]]);
    const result = calculateContributionPerformance(
      { amount: 100, date: '2026-08-07', cdiPercent: 100 },
      rates,
      '2026-08-12',
    );
    // dias no intervalo [07, 12): 07(sex usa 0.0005), 08(sab skip), 09(dom skip),
    // 10(seg proj), 11(ter proj) => 3 fatores
    const expectedGross = 100 * 1.0005 ** 3 - 100;
    expect(result.projectedBusinessDays).toBe(2);
    expect(result.grossYield).toBeCloseTo(expectedGross, 2);
    expect(result.netRedemptionValue).toBeGreaterThan(100);
  });

  it('no resgate parcial, IOF e IR acompanham a fração do principal', () => {
    const rates = new Map<string, number>([
      ['2026-08-01', 0.0005],
      ['2026-08-02', 0.0005],
      ['2026-08-03', 0.0005],
    ]);
    const full = calculateContributionPerformance(
      { amount: 1000, date: '2026-08-01', cdiPercent: 100 },
      rates,
      '2026-08-04',
    );
    const half = scalePerformance(full, 0.5);
    expect(half.principal).toBe(500);
    expect(half.grossYield).toBeCloseTo(full.grossYield / 2, 1);
    expect(half.iof).toBeCloseTo(full.iof / 2, 1);
    expect(half.incomeTax).toBeCloseTo(full.incomeTax / 2, 1);
    expect(half.incomeTaxRate).toBe(full.incomeTaxRate);
    expect(half.iofRate).toBe(full.iofRate);
    expect(half.netRedemptionValue).toBeCloseTo(full.netRedemptionValue / 2, 2);
  });
});
