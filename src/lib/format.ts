/** Number/time formatting helpers. Locale aware, never throws on bad input. */

export type Lang = 'zh' | 'en';

const LOCALES: Record<Lang, string> = { zh: 'zh-CN', en: 'en-US' };

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Pick a sensible number of decimals for a price magnitude.
 * Small-cap alt coins need more precision than BTC.
 */
export function priceDecimals(price: number): number {
  const abs = Math.abs(price);
  if (!Number.isFinite(abs) || abs === 0) return 2;
  if (abs >= 1000) return 2;
  if (abs >= 100) return 2;
  if (abs >= 1) return 3;
  if (abs >= 0.1) return 4;
  if (abs >= 0.01) return 5;
  if (abs >= 0.0001) return 6;
  return 8;
}

export function formatPrice(price: number | null | undefined, lang: Lang = 'en'): string {
  if (!isFiniteNumber(price)) return '—';
  const decimals = priceDecimals(price);
  return new Intl.NumberFormat(LOCALES[lang], {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(price);
}

/** Formats a percentage that is already expressed in percent units (1.23 -> "1.23%"). */
export function formatPercent(value: number | null | undefined, digits = 2): string {
  if (!isFiniteNumber(value)) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '' : '';
  return `${sign}${value.toFixed(digits)}%`;
}

/** Ratio (0.0123) to percent string ("1.23%"). */
export function formatRatioAsPercent(value: number | null | undefined, digits = 4): string {
  if (!isFiniteNumber(value)) return '—';
  const pct = value * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(digits)}%`;
}

export function formatCompact(value: number | null | undefined, lang: Lang = 'en'): string {
  if (!isFiniteNumber(value)) return '—';
  const abs = Math.abs(value);
  const units: Array<[number, string, string]> = [
    [1e12, 'T', '万亿'],
    [1e9, 'B', '十亿'],
    [1e6, 'M', '百万'],
    [1e3, 'K', '千'],
  ];
  for (const [size, suffix, zhSuffix] of units) {
    if (abs >= size) {
      const scaled = value / size;
      const digits = Math.abs(scaled) >= 100 ? 0 : Math.abs(scaled) >= 10 ? 1 : 2;
      return `${scaled.toFixed(digits)}${lang === 'zh' ? zhSuffix : suffix}`;
    }
  }
  if (abs >= 1) return value.toFixed(2);
  if (abs === 0) return '0';
  return value.toPrecision(4);
}

export function formatQuantity(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1000) return value.toFixed(2);
  if (abs >= 1) return value.toFixed(3);
  return value.toPrecision(4);
}

export function formatClock(ts: number | null | undefined, lang: Lang = 'en', withSeconds = true): string {
  if (!isFiniteNumber(ts)) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(LOCALES[lang], {
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {}),
    hour12: false,
  }).format(d);
}

export function formatDateTime(ts: number | null | undefined, lang: Lang = 'en'): string {
  if (!isFiniteNumber(ts)) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(LOCALES[lang], {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d);
}

/** Human readable "12s ago" style age. */
export function formatAge(ts: number | null | undefined, now: number, lang: Lang = 'en'): string {
  if (!isFiniteNumber(ts)) return '—';
  const diff = Math.max(0, Math.round((now - ts) / 1000));
  const zh = lang === 'zh';
  if (diff < 2) return zh ? '刚刚' : 'just now';
  if (diff < 60) return zh ? `${diff} 秒前` : `${diff}s ago`;
  const minutes = Math.floor(diff / 60);
  if (minutes < 60) return zh ? `${minutes} 分钟前` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return zh ? `${hours} 小时前` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return zh ? `${days} 天前` : `${days}d ago`;
}

/** Mid price from a bid/ask pair; null when either side is missing. */
export function midPrice(bid: number | null | undefined, ask: number | null | undefined): number | null {
  if (!isFiniteNumber(bid) || !isFiniteNumber(ask) || bid <= 0 || ask <= 0) return null;
  return (bid + ask) / 2;
}

/** Spread in percent of mid price: (ask - bid) / mid * 100. */
export function spreadPercent(bid: number | null | undefined, ask: number | null | undefined): number | null {
  if (!isFiniteNumber(bid) || !isFiniteNumber(ask)) return null;
  const mid = midPrice(bid, ask);
  if (mid === null || ask < bid) return null;
  return ((ask - bid) / mid) * 100;
}

export function median(values: number[]): number | null {
  const clean = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (clean.length === 0) return null;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 === 0 ? (clean[mid - 1] + clean[mid]) / 2 : clean[mid];
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
