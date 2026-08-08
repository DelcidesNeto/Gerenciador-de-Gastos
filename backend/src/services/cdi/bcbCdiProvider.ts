import type { CdiDailyRate } from '../../models/schemas';
import type { CdiProvider } from './cdiProvider';

/**
 * Banco Central — SGS série 12 (Taxa de juros - CDI).
 * Valores retornados pela API são % ao dia; convertemos para decimal.
 * Docs: https://dadosabertos.bcb.gov.br/dataset/12-taxa-de-juros---cdi
 */
const BCB_SERIES = '12';
const BCB_BASE = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${BCB_SERIES}/dados`;

function toBrDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function fromBrDate(br: string): string {
  const [d, m, y] = br.split('/');
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

export class BcbCdiProvider implements CdiProvider {
  readonly name = 'bcb-sgs-12';

  async fetchRates(startDate: string, endDate: string): Promise<CdiDailyRate[]> {
    if (startDate > endDate) return [];

    const url = `${BCB_BASE}?formato=json&dataInicial=${encodeURIComponent(toBrDate(startDate))}&dataFinal=${encodeURIComponent(toBrDate(endDate))}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Falha ao consultar CDI no BCB (${res.status})`);
    }
    if (!text || text.trimStart().startsWith('<')) {
      // BCB devolve XML quando o período não tem dados (ex.: datas futuras).
      return [];
    }

    let raw: Array<{ data: string; valor: string }>;
    try {
      raw = JSON.parse(text) as Array<{ data: string; valor: string }>;
    } catch {
      throw new Error('Resposta inválida do BCB ao consultar CDI');
    }

    if (!Array.isArray(raw)) return [];

    return raw
      .map((row) => ({
        date: fromBrDate(row.data),
        rate: Number(String(row.valor).replace(',', '.')) / 100,
      }))
      .filter((r) => Number.isFinite(r.rate));
  }
}

export const BCB_SERIES_CODE = BCB_SERIES;
