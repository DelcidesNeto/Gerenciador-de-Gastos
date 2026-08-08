import type { Env } from '../../env';
import type { CdiCacheFile, CdiDailyRate } from '../../models/schemas';
import { getJson, putJson } from '../../repositories/r2Json';
import { todayIso } from '../../utils/dates';
import { cdiCacheKey, r2Prefix } from '../../utils/paths';
import { BCB_SERIES_CODE, BcbCdiProvider } from './bcbCdiProvider';
import type { CdiProvider } from './cdiProvider';

const LOOKBACK_DAYS = 400;

export class CdiCacheService {
  constructor(
    private env: Env,
    private provider: CdiProvider = new BcbCdiProvider(),
  ) {}

  async getCache(): Promise<CdiCacheFile | null> {
    return getJson<CdiCacheFile>(this.env.APPLICATIONS, cdiCacheKey(r2Prefix(this.env)));
  }

  /**
   * Garante cache atualizado até no máximo "hoje".
   * Datas futuras na simulação usam projeção no yieldService a partir da última taxa conhecida.
   */
  async ensureRates(uptoDate = todayIso()): Promise<CdiCacheFile> {
    const today = todayIso();
    const fetchUntil = uptoDate < today ? uptoDate : today;

    const existing = await this.getCache();
    const lastDate = existing?.rates[existing.rates.length - 1]?.date;
    const stale =
      !existing ||
      existing.rates.length === 0 ||
      !lastDate ||
      lastDate < fetchUntil ||
      Date.now() - Date.parse(existing.updatedAt) > 12 * 60 * 60 * 1000;

    if (!stale && existing) return existing;

    const startDate = new Date(`${fetchUntil}T00:00:00.000Z`);
    startDate.setUTCDate(startDate.getUTCDate() - LOOKBACK_DAYS);
    const start = startDate.toISOString().slice(0, 10);

    let fetched: CdiDailyRate[] = [];
    try {
      fetched = await this.provider.fetchRates(start, fetchUntil);
    } catch (err) {
      console.error('Falha ao atualizar CDI; usando cache local se disponível', err);
      if (existing?.rates.length) return existing;
      throw err;
    }

    const merged = mergeRates(existing?.rates ?? [], fetched);
    if (merged.length === 0 && existing?.rates.length) {
      return existing;
    }

    const file: CdiCacheFile = {
      source: this.provider.name,
      seriesCode: BCB_SERIES_CODE,
      updatedAt: new Date().toISOString(),
      rates: merged,
    };
    await putJson(this.env.APPLICATIONS, cdiCacheKey(r2Prefix(this.env)), file);
    return file;
  }

  async getRateMap(uptoDate = todayIso()): Promise<Map<string, number>> {
    const cache = await this.ensureRates(uptoDate);
    return new Map(cache.rates.map((r) => [r.date, r.rate]));
  }
}

function mergeRates(a: CdiDailyRate[], b: CdiDailyRate[]): CdiDailyRate[] {
  const map = new Map<string, number>();
  for (const r of a) map.set(r.date, r.rate);
  for (const r of b) map.set(r.date, r.rate);
  return [...map.entries()]
    .sort(([d1], [d2]) => d1.localeCompare(d2))
    .map(([date, rate]) => ({ date, rate }));
}
