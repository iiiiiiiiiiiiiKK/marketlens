import type { ExchangeId, MarketKind, MarketTicker } from '../lib/types';
import { median, spreadPercent } from '../lib/format';

export interface MarketFilters {
  query: string;
  exchanges: ExchangeId[];
  kinds: MarketKind[];
  quotes: string[];
  favoritesOnly?: string[];
}

export function normaliseQuery(query: string): string {
  return query.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function matchesQuery(ticker: MarketTicker, query: string): boolean {
  const needle = normaliseQuery(query);
  if (!needle) return true;
  const rawSymbol = ticker.rawSymbol.toUpperCase();
  const base = ticker.base.toUpperCase();
  const display = `${ticker.base}/${ticker.quote}`.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return rawSymbol.includes(needle) || base.includes(needle) || display.includes(needle);
}

export function filterTickers(tickers: MarketTicker[], filters: MarketFilters): MarketTicker[] {
  return tickers.filter((ticker) => {
    if (filters.exchanges.length > 0 && !filters.exchanges.includes(ticker.exchange)) return false;
    if (filters.kinds.length > 0 && !filters.kinds.includes(ticker.kind)) return false;
    if (filters.quotes.length > 0 && !filters.quotes.includes(ticker.quote)) return false;
    if (filters.favoritesOnly && filters.favoritesOnly.length > 0 && !filters.favoritesOnly.includes(ticker.id)) {
      return false;
    }
    return matchesQuery(ticker, filters.query);
  });
}

export type SortKey =
  | 'symbol'
  | 'price'
  | 'changePercent24h'
  | 'high24h'
  | 'low24h'
  | 'volume24h'
  | 'quoteVolume24h'
  | 'fundingRate'
  | 'source';

export type SortDirection = 'asc' | 'desc';

const defaultScore = (ticker: MarketTicker) => ticker.quoteVolume24h ?? 0;

export function sortTickers(tickers: MarketTicker[], key: SortKey | null, direction: SortDirection): MarketTicker[] {
  if (!key) {
    return [...tickers].sort((a, b) => defaultScore(b) - defaultScore(a));
  }
  const factor = direction === 'asc' ? 1 : -1;
  return [...tickers].sort((a, b) => {
    if (key === 'symbol' || key === 'source') {
      const left = key === 'symbol' ? a.symbol : a.exchange;
      const right = key === 'symbol' ? b.symbol : b.exchange;
      const cmp = left.localeCompare(right);
      return cmp === 0 ? defaultScore(b) - defaultScore(a) : cmp * factor;
    }
    const leftRaw = a[key as keyof MarketTicker];
    const rightRaw = b[key as keyof MarketTicker];
    const left = typeof leftRaw === 'number' && Number.isFinite(leftRaw) ? leftRaw : null;
    const right = typeof rightRaw === 'number' && Number.isFinite(rightRaw) ? rightRaw : null;
    // Missing values always sink to the bottom, in both directions.
    if (left === null && right === null) return defaultScore(b) - defaultScore(a);
    if (left === null) return 1;
    if (right === null) return -1;
    if (left === right) return 0;
    return (left - right) * factor;
  });
}

export interface Breadth {
  advancing: number;
  declining: number;
  unchanged: number;
  total: number;
  turnover: number;
}

/** Market breadth across USDT spot pairs only — mixing perps would double count. */
export function marketBreadth(tickers: MarketTicker[]): Breadth {
  let advancing = 0;
  let declining = 0;
  let unchanged = 0;
  let turnover = 0;
  for (const ticker of tickers) {
    if (ticker.kind !== 'spot' || ticker.quote !== 'USDT') continue;
    if (ticker.quoteVolume24h) turnover += ticker.quoteVolume24h;
    const change = ticker.changePercent24h;
    if (change === null) continue;
    if (change > 0.05) advancing += 1;
    else if (change < -0.05) declining += 1;
    else unchanged += 1;
  }
  return { advancing, declining, unchanged, total: advancing + declining + unchanged, turnover };
}

export function topMovers(tickers: MarketTicker[], count = 5): { gainers: MarketTicker[]; losers: MarketTicker[] } {
  const candidates = tickers.filter(
    (ticker) =>
      ticker.kind === 'spot' &&
      ticker.quote === 'USDT' &&
      (ticker.quoteVolume24h ?? 0) > 5_000_000 &&
      ticker.changePercent24h !== null,
  );
  const sorted = [...candidates].sort((a, b) => (b.changePercent24h ?? 0) - (a.changePercent24h ?? 0));
  return { gainers: sorted.slice(0, count), losers: sorted.slice(-count).reverse() };
}

export interface CompareRow {
  ticker: MarketTicker;
  spreadPct: number | null;
  diffFromMedianPct: number | null;
}

export interface CompareResult {
  rows: CompareRow[];
  medianPrice: number | null;
  sameQuote: boolean;
  kindMismatch: boolean;
  bestAsk: CompareRow | null;
  bestBid: CompareRow | null;
}

/** Builds like-for-like comparison rows for one base/quote pair. */
export function buildCompare(tickers: MarketTicker[], base: string, quote: string): CompareResult {
  const matches = tickers.filter(
    (ticker) => ticker.base.toUpperCase() === base.toUpperCase() && ticker.quote.toUpperCase() === quote.toUpperCase(),
  );
  const prices = matches.map((ticker) => ticker.price);
  const medianPrice = median(prices);
  const rows: CompareRow[] = matches.map((ticker) => ({
    ticker,
    spreadPct: spreadPercent(ticker.bid, ticker.ask),
    diffFromMedianPct:
      medianPrice && medianPrice > 0 ? ((ticker.price - medianPrice) / medianPrice) * 100 : null,
  }));
  rows.sort((a, b) => a.ticker.price - b.ticker.price);
  const withAsk = rows.filter((row) => row.ticker.ask !== null);
  const withBid = rows.filter((row) => row.ticker.bid !== null);
  return {
    rows,
    medianPrice,
    sameQuote: new Set(matches.map((ticker) => ticker.quote)).size <= 1,
    kindMismatch: new Set(matches.map((ticker) => ticker.kind)).size > 1,
    bestAsk: withAsk.length > 0 ? withAsk.reduce((min, row) => ((row.ticker.ask ?? 0) < (min.ticker.ask ?? 0) ? row : min)) : null,
    bestBid: withBid.length > 0 ? withBid.reduce((max, row) => ((row.ticker.bid ?? 0) > (max.ticker.bid ?? 0) ? row : max)) : null,
  };
}

/** All base assets that trade on at least two venues, for the comparison picker. */
export function comparablePairs(tickers: MarketTicker[]): Array<{ base: string; quote: string; venues: number }> {
  const map = new Map<string, { base: string; quote: string; venues: Set<string> }>();
  for (const ticker of tickers) {
    const key = `${ticker.base}/${ticker.quote}`;
    const entry = map.get(key) ?? { base: ticker.base, quote: ticker.quote, venues: new Set<string>() };
    entry.venues.add(ticker.exchange);
    map.set(key, entry);
  }
  return [...map.values()]
    .filter((entry) => entry.venues.size >= 2)
    .map((entry) => ({ base: entry.base, quote: entry.quote, venues: entry.venues.size }))
    .sort((a, b) => b.venues - a.venues || a.base.localeCompare(b.base));
}

/** Quote assets present in the dataset, most common first. */
export function quoteOptions(tickers: MarketTicker[]): string[] {
  const counts = new Map<string, number>();
  for (const ticker of tickers) counts.set(ticker.quote, (counts.get(ticker.quote) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([quote]) => quote);
}

export function findReferenceTicker(tickers: MarketTicker[], base: string): MarketTicker | null {
  const preferred: ExchangeId[] = ['binance-spot', 'bybit-spot'];
  for (const exchange of preferred) {
    const match = tickers.find(
      (ticker) => ticker.exchange === exchange && ticker.base === base && ticker.quote === 'USDT',
    );
    if (match) return match;
  }
  return tickers.find((ticker) => ticker.kind === 'spot' && ticker.base === base && ticker.quote === 'USDT') ?? null;
}
