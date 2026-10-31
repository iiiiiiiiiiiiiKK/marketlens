import { getJson, num } from '../lib/http';
import type {
  Candle,
  ChartInterval,
  FundingHistoryPoint,
  FundingSnapshot,
  InstrumentMeta,
  MarketTicker,
  OrderBook,
} from '../lib/types';
import type { InstrumentCacheEntry, MarketAdapter } from './base';
import { normaliseCandles, parseLevels, pickBookDepth, toTicker, withInstrumentCache } from './base';

const BASE = 'https://api.binance.com';
const cache: { current: InstrumentCacheEntry | null } = { current: null };

interface BinanceSymbolInfo {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
}

interface Binance24hr {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  bidPrice: string;
  askPrice: string;
  closeTime: number;
}

function loadInstruments(): Promise<Map<string, InstrumentMeta>> {
  return withInstrumentCache(cache, async () => {
    const body = await getJson<{ symbols: BinanceSymbolInfo[] }>(`${BASE}/api/v3/exchangeInfo`);
    const map = new Map<string, InstrumentMeta>();
    for (const item of body.symbols ?? []) {
      if (item.status !== 'TRADING') continue;
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

export const binanceSpot: MarketAdapter = {
  id: 'binance-spot',
  label: 'Binance',
  kind: 'spot',
  endpoint: 'https://api.binance.com',
  docsUrl: 'https://developers.binance.com/docs/binance-spot-api-docs',
  intervals: ['1m', '5m', '15m', '1h', '4h', '1d', '1w'],
  bookDepths: [5, 10, 20, 50, 100, 500, 1000],

  async fetchTickers(signal) {
    const [instruments, rows] = await Promise.all([
      loadInstruments(),
      getJson<Binance24hr[]>(`${BASE}/api/v3/ticker/24hr`, { signal, timeoutMs: 15_000 }),
    ]);
    const now = Date.now();
    const out: MarketTicker[] = [];
    for (const row of rows) {
      const meta = instruments.get(row.symbol);
      if (!meta) continue;
      const ticker = toTicker({
        exchange: 'binance-spot',
        kind: 'spot',
        rawSymbol: row.symbol,
        base: meta.base,
        quote: meta.quote,
        price: num(row.lastPrice),
        changePercent24h: num(row.priceChangePercent),
        high24h: num(row.highPrice),
        low24h: num(row.lowPrice),
        volume24h: num(row.volume),
        quoteVolume24h: num(row.quoteVolume),
        bid: num(row.bidPrice),
        ask: num(row.askPrice),
        timestamp: Number.isFinite(row.closeTime) ? row.closeTime : now,
      });
      if (ticker) out.push(ticker);
    }
    return out;
  },

  async fetchKlines(rawSymbol, interval: ChartInterval, limit, signal) {
    const url = `${BASE}/api/v3/klines?symbol=${encodeURIComponent(rawSymbol)}&interval=${interval}&limit=${limit}`;
    const rows = await getJson<unknown[][]>(url, { signal });
    const candles: Candle[] = (rows ?? []).map((row) => ({
      time: Math.floor(Number(row[0]) / 1000),
      open: num(row[1]) ?? 0,
      high: num(row[2]) ?? 0,
      low: num(row[3]) ?? 0,
      close: num(row[4]) ?? 0,
      volume: num(row[5]) ?? 0,
    }));
    return normaliseCandles(candles);
  },

  async fetchOrderBook(rawSymbol, limit, signal): Promise<OrderBook> {
    const depth = pickBookDepth(limit, this.bookDepths);
    const url = `${BASE}/api/v3/depth?symbol=${encodeURIComponent(rawSymbol)}&limit=${depth}`;
    const body = await getJson<{ lastUpdateId: number; bids: unknown[]; asks: unknown[] }>(url, { signal });
    return {
      exchange: 'binance-spot',
      rawSymbol,
      bids: parseLevels(body.bids, 'bid', limit),
      asks: parseLevels(body.asks, 'ask', limit),
      timestamp: Date.now(),
      fetchedAt: Date.now(),
    };
  },

  async fetchFunding(): Promise<FundingSnapshot | null> {
    // Spot markets have no funding rate. Never invent one.
    return null;
  },

  async fetchFundingHistory(): Promise<FundingHistoryPoint[]> {
    return [];
  },
};
