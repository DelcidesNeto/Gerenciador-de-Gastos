import type { Env } from '../../env';
import type { CdiCacheFile, CdiDailyRate } from '../../models/schemas';
import { runBatches } from '../../db/mappers';
import { todayIso } from '../../utils/dates';
import { BCB_SERIES_CODE, BcbCdiProvider } from './bcbCdiProvider';
import type { CdiProvider } from './cdiProvider';

const LOOKBACK_DAYS = 400;

export class CdiCacheService {
  constructor(
    private env: Env,
    private provider: CdiProvider = new BcbCdiProvider(),
  ) {}

  async getCache(): Promise<CdiCacheFile | null> {
    const meta = await this.env.DB.prepare(
      'SELECT source, series_code, updated_at FROM cdi_cache_meta WHERE id = 1',
    ).first<{ source: string; series_code: string; updated_at: string }>();
    if (!meta) return null;

    const rates = await this.env.DB.prepare(
      'SELECT date, rate FROM cdi_rates ORDER BY date ASC',
    ).all<CdiDailyRate>();

    return {
      source: meta.source,
      seriesCode: meta.series_code,
      updatedAt: meta.updated_at,
      rates: rates.results ?? [],
    };
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
    await this.saveCache(file);
    return file;
  }

  async getRateMap(uptoDate = todayIso()): Promise<Map<string, number>> {
    const cache = await this.ensureRates(uptoDate);
    return new Map(cache.rates.map((r) => [r.date, r.rate]));
  }

  async saveCache(file: CdiCacheFile): Promise<void> {
    const stmts: D1PreparedStatement[] = [
      this.env.DB.prepare('DELETE FROM cdi_rates'),
      this.env.DB.prepare(
        `INSERT INTO cdi_cache_meta (id, source, series_code, updated_at)
         VALUES (1, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           source = excluded.source,
           series_code = excluded.series_code,
           updated_at = excluded.updated_at`,
      ).bind(file.source, file.seriesCode, file.updatedAt),
      ...file.rates.map((r) =>
        this.env.DB.prepare('INSERT INTO cdi_rates (date, rate) VALUES (?, ?)').bind(
          r.date,
          r.rate,
        ),
      ),
    ];
    await runBatches(this.env.DB, stmts);
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
