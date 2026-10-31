import { getJson, num } from '../lib/http';
import type {
  Candle,
  ChartInterval,
  FundingHistoryPoint,
  InstrumentMeta,
  MarketTicker,
  OrderBook,
} from '../lib/types';
import type { InstrumentCacheEntry } from './base';
import { normaliseCandles, parseLevels, pickBookDepth, toTicker, withInstrumentCache } from './base';

export const BYBIT_BASE = 'https://api.bybit.com';

/** Bybit v5 kline interval codes. */
export const BYBIT_INTERVALS: Record<ChartInterval, string> = {
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '1h': '60',
  '4h': '240',
  '1d': 'D',
  '1w': 'W',
};

export const BYBIT_BOOK_DEPTHS = [1, 50, 200, 500];

interface BybitEnvelope<T> {
  retCode: number;
  retMsg: string;
  result: T;
}

interface BybitInstrument {
  symbol: string;
  baseCoin: string;
  quoteCoin: string;
  status: string;
  contractType?: string;
}

export interface BybitTicker {
  symbol: string;
  lastPrice: string;
  prevPrice24h?: string;
  price24hPcnt?: string;
  highPrice24h?: string;
  lowPrice24h?: string;
  volume24h?: string;
  turnover24h?: string;
  bid1Price?: string;
  ask1Price?: string;
  fundingRate?: string;
  nextFundingTime?: string;
  markPrice?: string;
  indexPrice?: string;
}

/** Bybit percent fields are ratios (0.0123 = 1.23%). */
export function bybitPercentToPercent(value: string | undefined): number | null {
  const ratio = num(value);
  if (ratio === null) return null;
  return ratio * 100;
}

async function loadInstruments(category: 'spot' | 'linear'): Promise<Map<string, InstrumentMeta>> {
  const map = new Map<string, InstrumentMeta>();
  let cursor = '';
  for (let page = 0; page < 6; page += 1) {
    const url = `${BYBIT_BASE}/v5/market/instruments-info?category=${category}&limit=1000${
      cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
    }`;
    const body = await getJson<BybitEnvelope<{ list: BybitInstrument[]; nextPageCursor?: string }>>(url);
    if (body.retCode !== 0) throw new Error(`Bybit instruments-info retCode ${body.retCode}: ${body.retMsg}`);
    for (const item of body.result?.list ?? []) {
      if (item.status !== 'Trading') continue;
      if (category === 'linear' && item.contractType && item.contractType !== 'LinearPerpetual') continue;
      map.set(item.symbol, {
        rawSymbol: item.symbol,
        base: item.baseCoin,
        quote: item.quoteCoin,
        status: item.status,
      });
    }
    cursor = body.result?.nextPageCursor ?? '';
    if (!cursor) break;
  }
  return map;
}

/** Shared Bybit kline/order-book plumbing for spot and linear categories. */
export function createBybitKlines(category: 'spot' | 'linear') {
  return async function fetchKlines(
    rawSymbol: string,
    interval: ChartInterval,
    limit: number,
    signal?: AbortSignal,
  ): Promise<Candle[]> {
    const code = BYBIT_INTERVALS[interval];
    const url = `${BYBIT_BASE}/v5/market/kline?category=${category}&symbol=${encodeURIComponent(
      rawSymbol,
    )}&interval=${code}&limit=${Math.min(limit, 1000)}`;
    const body = await getJson<BybitEnvelope<{ list: string[][] }>>(url, { signal });
    if (body.retCode !== 0) throw new Error(`Bybit kline retCode ${body.retCode}: ${body.retMsg}`);
    // Bybit returns newest first: [start, open, high, low, close, volume, turnover]
    return normaliseCandles(
      (body.result?.list ?? []).map((row) => ({
        time: Math.floor(Number(row[0]) / 1000),
        open: num(row[1]) ?? 0,
        high: num(row[2]) ?? 0,
        low: num(row[3]) ?? 0,
        close: num(row[4]) ?? 0,
        volume: num(row[5]) ?? 0,
      })),
    );
  };
}

export function createBybitOrderBook(category: 'spot' | 'linear', exchange: 'bybit-spot' | 'bybit-linear') {
  return async function fetchOrderBook(rawSymbol: string, limit: number, signal?: AbortSignal): Promise<OrderBook> {
    const depth = pickBookDepth(limit, BYBIT_BOOK_DEPTHS);
    const url = `${BYBIT_BASE}/v5/market/orderbook?category=${category}&symbol=${encodeURIComponent(
      rawSymbol,
    )}&limit=${depth}`;
    const body = await getJson<BybitEnvelope<{ s: string; b: unknown[]; a: unknown[]; ts: number }>>(url, { signal });
    if (body.retCode !== 0) throw new Error(`Bybit orderbook retCode ${body.retCode}: ${body.retMsg}`);
    const ts = Number(body.result?.ts);
    const now = Date.now();
    return {
      exchange,
      rawSymbol,
      bids: parseLevels(body.result?.b, 'bid', limit),
      asks: parseLevels(body.result?.a, 'ask', limit),
      timestamp: Number.isFinite(ts) ? ts : now,
      fetchedAt: now,
    };
  };
}

export function createBybitTickersLoader(category: 'spot' | 'linear', cache: { current: InstrumentCacheEntry | null }) {
  return async function fetchTickers(signal?: AbortSignal): Promise<MarketTicker[]> {
    const [instruments, body] = await Promise.all([
      withInstrumentCache(cache, () => loadInstruments(category)),
      getJson<BybitEnvelope<{ list: BybitTicker[] }>>(
        `${BYBIT_BASE}/v5/market/tickers?category=${category}`,
        { signal, timeoutMs: 15_000 },
      ),
    ]);
    if (body.retCode !== 0) throw new Error(`Bybit tickers retCode ${body.retCode}: ${body.retMsg}`);
    const now = Date.now();
    const out: MarketTicker[] = [];
    for (const row of body.result?.list ?? []) {
      const meta = instruments.get(row.symbol);
      if (!meta) continue;
      const nextFunding = num(row.nextFundingTime);
      const ticker = toTicker({
        exchange: category === 'spot' ? 'bybit-spot' : 'bybit-linear',
        kind: category === 'spot' ? 'spot' : 'futures',
        rawSymbol: row.symbol,
        base: meta.base,
        quote: meta.quote,
        price: num(row.lastPrice),
        changePercent24h: bybitPercentToPercent(row.price24hPcnt),
        high24h: num(row.highPrice24h),
        low24h: num(row.lowPrice24h),
        volume24h: num(row.volume24h),
        quoteVolume24h: num(row.turnover24h),
        bid: num(row.bid1Price),
        ask: num(row.ask1Price),
        fundingRate: num(row.fundingRate),
        nextFundingTime: nextFunding && nextFunding > 0 ? nextFunding : null,
        markPrice: num(row.markPrice),
        timestamp: now,
      });
      if (ticker) out.push(ticker);
    }
    return out;
  };
}

export function createBybitFundingHistory() {
  return async function fetchFundingHistory(
    rawSymbol: string,
    limit: number,
    signal?: AbortSignal,
  ): Promise<FundingHistoryPoint[]> {
    const url = `${BYBIT_BASE}/v5/market/funding/history?category=linear&symbol=${encodeURIComponent(
      rawSymbol,
    )}&limit=${Math.min(limit, 200)}`;
    const body = await getJson<BybitEnvelope<{ list: Array<{ fundingRate: string; fundingRateTimestamp: string }> }>>(
      url,
      { signal },
    );
    if (body.retCode !== 0) return [];
    return (body.result?.list ?? [])
      .map((row) => ({ time: Number(row.fundingRateTimestamp), rate: num(row.fundingRate) ?? 0 }))
      .filter((row) => Number.isFinite(row.time))
      .sort((a, b) => a.time - b.time);
  };
}
