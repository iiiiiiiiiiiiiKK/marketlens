import type {
  Candle,
  ChartInterval,
  ExchangeId,
  FundingHistoryPoint,
  FundingSnapshot,
  InstrumentMeta,
  MarketKind,
  MarketTicker,
  OrderBook,
} from '../lib/types';
import { num } from '../lib/http';

/** Everything the UI needs from a venue. Implemented per exchange / market type. */
export interface MarketAdapter {
  readonly id: ExchangeId;
  /** Venue display name, e.g. "Binance". */
  readonly label: string;
  readonly kind: MarketKind;
  /** Marketing-free factual endpoint base, shown in the UI + README. */
  readonly endpoint: string;
  readonly docsUrl: string;
  /** Intervals the public kline endpoint accepts. */
  readonly intervals: ChartInterval[];
  /** Order book depths the venue accepts, ascending. */
  readonly bookDepths: number[];
  fetchTickers(signal?: AbortSignal): Promise<MarketTicker[]>;
  fetchKlines(rawSymbol: string, interval: ChartInterval, limit: number, signal?: AbortSignal): Promise<Candle[]>;
  fetchOrderBook(rawSymbol: string, limit: number, signal?: AbortSignal): Promise<OrderBook>;
  fetchFunding(rawSymbol: string, signal?: AbortSignal): Promise<FundingSnapshot | null>;
  fetchFundingHistory(rawSymbol: string, limit: number, signal?: AbortSignal): Promise<FundingHistoryPoint[]>;
}

export interface InstrumentCacheEntry {
  data: Map<string, InstrumentMeta>;
  at: number;
}

const INSTRUMENT_TTL = 30 * 60 * 1000;

/** Caches an exchange symbol directory for 30 minutes (rarely changes). */
export async function withInstrumentCache(
  cache: { current: InstrumentCacheEntry | null },
  loader: () => Promise<Map<string, InstrumentMeta>>,
): Promise<Map<string, InstrumentMeta>> {
  const now = Date.now();
  if (cache.current && now - cache.current.at < INSTRUMENT_TTL) return cache.current.data;
  const data = await loader();
  cache.current = { data, at: now };
  return data;
}

export function pickBookDepth(requested: number, supported: number[]): number {
  const sorted = [...supported].sort((a, b) => a - b);
  return sorted.find((value) => value >= requested) ?? sorted[sorted.length - 1];
}

/** Builds the canonical ticker id used across the app. */
export function tickerId(exchange: ExchangeId, rawSymbol: string): string {
  return `${exchange}:${rawSymbol}`;
}

export function displaySymbol(base: string, quote: string): string {
  return `${base}/${quote}`;
}

export function toTicker(params: {
  exchange: ExchangeId;
  kind: MarketKind;
  rawSymbol: string;
  base: string;
  quote: string;
  price: number | null;
  changePercent24h?: number | null;
  high24h?: number | null;
  low24h?: number | null;
  volume24h?: number | null;
  quoteVolume24h?: number | null;
  bid?: number | null;
  ask?: number | null;
  fundingRate?: number | null;
  nextFundingTime?: number | null;
  markPrice?: number | null;
  timestamp: number;
}): MarketTicker | null {
  if (params.price === null || !Number.isFinite(params.price) || params.price <= 0) return null;
  return {
    exchange: params.exchange,
    kind: params.kind,
    id: tickerId(params.exchange, params.rawSymbol),
    rawSymbol: params.rawSymbol,
    symbol: displaySymbol(params.base, params.quote),
    base: params.base,
    quote: params.quote,
    price: params.price,
    changePercent24h: params.changePercent24h ?? null,
    high24h: params.high24h ?? null,
    low24h: params.low24h ?? null,
    volume24h: params.volume24h ?? null,
    quoteVolume24h: params.quoteVolume24h ?? null,
    bid: params.bid ?? null,
    ask: params.ask ?? null,
    fundingRate: params.fundingRate ?? null,
    nextFundingTime: params.nextFundingTime ?? null,
    markPrice: params.markPrice ?? null,
    timestamp: params.timestamp,
    fetchedAt: Date.now(),
  };
}

/** Sorts candles ascending, drops malformed rows and de-duplicates timestamps. */
export function normaliseCandles(rows: Candle[]): Candle[] {
  const byTime = new Map<number, Candle>();
  for (const row of rows) {
    if (
      !Number.isFinite(row.time) ||
      !Number.isFinite(row.open) ||
      !Number.isFinite(row.high) ||
      !Number.isFinite(row.low) ||
      !Number.isFinite(row.close)
    ) {
      continue;
    }
    if (row.close <= 0) continue;
    byTime.set(row.time, {
      time: row.time,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: Number.isFinite(row.volume) ? row.volume : 0,
    });
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

/** Normalises a [[price, qty], ...] ladder into typed levels, best price first. */
export function parseLevels(rows: unknown, side: 'bid' | 'ask', limit: number) {
  if (!Array.isArray(rows)) return [];
  const levels = rows
    .map((row) => {
      if (!Array.isArray(row)) return null;
      const price = num(row[0]);
      const qty = num(row[1]);
      if (price === null || qty === null || price <= 0 || qty < 0) return null;
      return { price, qty };
    })
    .filter((level): level is { price: number; qty: number } => level !== null);
  levels.sort((a, b) => (side === 'bid' ? b.price - a.price : a.price - b.price));
  return levels.slice(0, limit);
}
