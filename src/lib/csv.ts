import type { Lang } from './i18n';
import { translate } from './i18n';
import type { MarketTicker } from './types';
import { getAdapter } from '../data';

function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[",\n;]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function iso(ts: number | null | undefined): string {
  if (typeof ts !== 'number' || !Number.isFinite(ts)) return '';
  return new Date(ts).toISOString();
}

/**
 * Builds the CSV export. Every row carries its own exchange timestamp and the
 * time it was received locally, plus the endpoint the row came from — rows are
 * explicitly NOT a single synchronised snapshot.
 */
export function buildCsv(rows: MarketTicker[], lang: Lang): string {
  const header = [
    translate(lang, 'csv.header.exchange'),
    translate(lang, 'csv.header.marketType'),
    translate(lang, 'csv.header.pair'),
    translate(lang, 'csv.header.rawSymbol'),
    translate(lang, 'csv.header.lastPrice'),
    translate(lang, 'csv.header.change24h'),
    translate(lang, 'csv.header.volume24h'),
    translate(lang, 'csv.header.quoteVolume24h'),
    translate(lang, 'csv.header.bid'),
    translate(lang, 'csv.header.ask'),
    translate(lang, 'csv.header.fundingRate'),
    translate(lang, 'csv.header.nextFunding'),
    translate(lang, 'csv.header.exchangeTimestamp'),
    translate(lang, 'csv.header.fetchedAt'),
    translate(lang, 'csv.header.source'),
  ];

  const lines = rows.map((ticker) =>
    [
      ticker.exchange,
      ticker.kind,
      ticker.symbol,
      ticker.rawSymbol,
      ticker.price,
      ticker.changePercent24h ?? '',
      ticker.volume24h ?? '',
      ticker.quoteVolume24h ?? '',
      ticker.bid ?? '',
      ticker.ask ?? '',
      ticker.fundingRate ?? '',
      iso(ticker.nextFundingTime),
      iso(ticker.timestamp),
      iso(ticker.fetchedAt),
      getAdapter(ticker.exchange).endpoint,
    ]
      .map(escapeCell)
      .join(','),
  );

  return [header.map(escapeCell).join(','), ...lines].join('\r\n');
}

export function csvFilename(kind: string, now = new Date()): string {
  const stamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  return `marketlens-${kind}-${stamp}.csv`;
}

/** Triggers a browser download. Uses a BOM so Excel detects UTF-8. */
export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([`\ufeff${content}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
