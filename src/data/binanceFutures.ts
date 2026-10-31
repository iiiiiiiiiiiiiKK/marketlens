import { getJson, num } from '../lib/http';
import type {
  ChartInterval,
  FundingHistoryPoint,
  FundingSnapshot,
  InstrumentMeta,
  MarketTicker,
  OrderBook,
} from '../lib/types';
import type { InstrumentCacheEntry, MarketAdapter } from './base';
import { normaliseCandles, parseLevels, pickBookDepth, toTicker, withInstrumentCache } from './base';

const BASE = 'https://fapi.binance.com';
const cache: { current: InstrumentCacheEntry | null } = { current: null };

interface FuturesSymbolInfo {
  symbol: string;
  status: string;
  contractType: string;
  baseAsset: string;
  quoteAsset: string;
}

interface Futures24hr {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  closeTime: number;
}

interface PremiumIndex {
  symbol: string;
  markPrice: string;
  indexPrice: string;
  lastFundingRate: string;
  nextFundingTime: number;
}

function loadInstruments(): Promise<Map<string, InstrumentMeta>> {
  return withInstrumentCache(cache, async () => {
    const body = await getJson<{ symbols: FuturesSymbolInfo[] }>(`${BASE}/fapi/v1/exchangeInfo`);
    const map = new Map<string, InstrumentMeta>();
    for (const item of body.symbols ?? []) {
      // Only perpetual contracts — never present a delivery contract as a perp.
      if (item.status !== 'TRADING' || item.contractType !== 'PERPETUAL') continue;
      map.set(item.symbol, {
        rawSymbol: item.symbol,
        base: item.baseAsset,
        quote: item.quoteAsset,
        status: item.status,
      });
    }
    return map;
  });
}

export const binanceFutures: MarketAdapter = {
  id: 'binance-futures',
  label: 'Binance',
  kind: 'futures',
  endpoint: 'https://fapi.binance.com',
  docsUrl: 'https://developers.binance.com/docs/derivatives/usds-margined-futures',
  intervals: ['1m', '5m', '15m', '1h', '4h', '1d', '1w'],
  bookDepths: [5, 10, 20, 50, 100, 500, 1000],

  async fetchTickers(signal) {
    const [instruments, rows, premium] = await Promise.all([
      loadInstruments(),
      getJson<Futures24hr[]>(`${BASE}/fapi/v1/ticker/24hr`, { signal, timeoutMs: 15_000 }),
      getJson<PremiumIndex[]>(`${BASE}/fapi/v1/premiumIndex`, { signal, timeoutMs: 15_000 }),
    ]);
    const funding = new Map<string, PremiumIndex>();
    for (const item of premium ?? []) funding.set(item.symbol, item);

    const now = Date.now();
    const out: MarketTicker[] = [];
    for (const row of rows) {
      const meta = instruments.get(row.symbol);
      if (!meta) continue;
      const prem = funding.get(row.symbol);
      const ticker = toTicker({
        exchange: 'binance-futures',
        kind: 'futures',
        rawSymbol: row.symbol,
        base: meta.base,
        quote: meta.quote,
        price: num(row.lastPrice),
        changePercent24h: num(row.priceChangePercent),
        high24h: num(row.highPrice),
        low24h: num(row.lowPrice),
        volume24h: num(row.volume),
        quoteVolume24h: num(row.quoteVolume),
        fundingRate: prem ? num(prem.lastFundingRate) : null,
        nextFundingTime: prem && prem.nextFundingTime > 0 ? prem.nextFundingTime : null,
        markPrice: prem ? num(prem.markPrice) : null,
        timestamp: Number.isFinite(row.closeTime) ? row.closeTime : now,
      });
      if (ticker) out.push(ticker);
    }
    return out;
  },

  async fetchKlines(rawSymbol, interval: ChartInterval, limit, signal) {
    const url = `${BASE}/fapi/v1/klines?symbol=${encodeURIComponent(rawSymbol)}&interval=${interval}&limit=${limit}`;
    const rows = await getJson<unknown[][]>(url, { signal });
    return normaliseCandles(
      (rows ?? []).map((row) => ({
        time: Math.floor(Number(row[0]) / 1000),
        open: num(row[1]) ?? 0,
        high: num(row[2]) ?? 0,
        low: num(row[3]) ?? 0,
        close: num(row[4]) ?? 0,
        volume: num(row[5]) ?? 0,
      })),
    );
  },

  async fetchOrderBook(rawSymbol, limit, signal): Promise<OrderBook> {
    const depth = pickBookDepth(limit, this.bookDepths);
    const url = `${BASE}/fapi/v1/depth?symbol=${encodeURIComponent(rawSymbol)}&limit=${depth}`;
    const body = await getJson<{ bids: unknown[]; asks: unknown[]; T?: number }>(url, { signal });
    const now = Date.now();
    return {
      exchange: 'binance-futures',
      rawSymbol,
      bids: parseLevels(body.bids, 'bid', limit),
      asks: parseLevels(body.asks, 'ask', limit),
      timestamp: Number.isFinite(body.T) ? Number(body.T) : now,
      fetchedAt: now,
    };
  },

  async fetchFunding(rawSymbol, signal): Promise<FundingSnapshot | null> {
    const body = await getJson<PremiumIndex>(
      `${BASE}/fapi/v1/premiumIndex?symbol=${encodeURIComponent(rawSymbol)}`,
      { signal },
    );
    if (!body || !body.symbol) return null;
    return {
      rate: num(body.lastFundingRate),
      nextFundingTime: body.nextFundingTime > 0 ? body.nextFundingTime : null,
      markPrice: num(body.markPrice),
      indexPrice: num(body.indexPrice),
      intervalHours: 8,
    };
  },

  async fetchFundingHistory(rawSymbol, limit, signal): Promise<FundingHistoryPoint[]> {
    const body = await getJson<Array<{ fundingTime: number; fundingRate: string }>>(
      `${BASE}/fapi/v1/fundingRate?symbol=${encodeURIComponent(rawSymbol)}&limit=${limit}`,
      { signal },
    );
    return (body ?? [])
      .map((row) => ({ time: Number(row.fundingTime), rate: num(row.fundingRate) ?? 0 }))
      .filter((row) => Number.isFinite(row.time))
      .sort((a, b) => a.time - b.time);
  },
};
