/** Datas no formato YYYY-MM-DD (calendário local/UTC-date puro). */

export function parseIsoDate(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Data inválida: ${iso}`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    throw new Error(`Data inválida: ${iso}`);
  }
  return d;
}

export function toIsoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

/** Dias corridos entre duas datas ISO (inclusivo no cálculo de alíquota: diferença). */
export function daysBetween(startIso: string, endIso: string): number {
  const start = parseIsoDate(startIso).getTime();
  const end = parseIsoDate(endIso).getTime();
  return Math.floor((end - start) / 86_400_000);
}

export function eachCalendarDate(startIso: string, endIsoExclusive: string): string[] {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIsoExclusive);
  const out: string[] = [];
  for (let t = start.getTime(); t < end.getTime(); t += 86_400_000) {
    out.push(toIsoDate(new Date(t)));
  }
  return out;
}

export function monthKeyFromIso(iso: string): string {
  return iso.slice(0, 7);
}
