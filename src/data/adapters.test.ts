import { afterEach, describe, expect, it, vi } from 'vitest';
import { bybitPercentToPercent, BYBIT_INTERVALS } from './bybit';
import { displaySymbol, normaliseCandles, parseLevels, pickBookDepth, tickerId, toTicker } from './base';
import { clearHttpCache } from '../lib/http';
import { binanceSpot } from './binanceSpot';
import { binanceFutures } from './binanceFutures';
import { bybitLinear } from './bybitLinear';
import {
  BINANCE_DEPTH,
  BINANCE_EXCHANGE_INFO,
  BINANCE_KLINES,
  BINANCE_TICKERS,
  BYBIT_INSTRUMENTS,
  BYBIT_KLINES,
  BYBIT_TICKERS,
} from '../test/fixtures';

const BINANCE_FUT_INFO = {
  symbols: [
    { symbol: 'BTCUSDT', status: 'TRADING', contractType: 'PERPETUAL', baseAsset: 'BTC', quoteAsset: 'USDT' },
    { symbol: 'BTCUSDT_251226', status: 'TRADING', contractType: 'CURRENT_QUARTER', baseAsset: 'BTC', quoteAsset: 'USDT' },
  ],
};

const BINANCE_FUT_TICKERS = [
  {
    symbol: 'BTCUSDT',
    lastPrice: '65020.00',
    priceChangePercent: '2.050',
    highPrice: '66000',
    lowPrice: '64000',
    volume: '250000',
    quoteVolume: '1500000000',
    closeTime: 1_700_000_000_000,
  },
];

const BINANCE_PREMIUM = [
  { symbol: 'BTCUSDT', markPrice: '65018.5', indexPrice: '65010', lastFundingRate: '0.00010000', nextFundingTime: 1_700_003_600_000 },
];

const BYBIT_LINEAR_TICKERS = {
  retCode: 0,
  retMsg: 'OK',
  result: {
    list: [
      {
        symbol: 'BTCUSDT',
        lastPrice: '65005',
        price24hPcnt: '0.0198',
        highPrice24h: '66000',
        lowPrice24h: '63000',
        volume24h: '100000',
        turnover24h: '700000000',
        fundingRate: '-0.0002',
        nextFundingTime: '1700003600000',
        markPrice: '65004',
      },
    ],
  },
};

/** Minimal fetch stub that routes by URL substring. */
function stubFetch(routes: Array<[string, unknown]>) {
  const calls: string[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const match = routes.find(([fragment]) => url.includes(fragment));
    if (!match) return new Response('not found', { status: 404 });
    return new Response(JSON.stringify(match[1]), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

afterEach(() => {
  vi.unstubAllGlobals();
  clearHttpCache();
});

describe('shared helpers', () => {
  it('builds canonical ids and display symbols', () => {
    expect(tickerId('binance-spot', 'BTCUSDT')).toBe('binance-spot:BTCUSDT');
    expect(displaySymbol('BTC', 'USDT')).toBe('BTC/USDT');
  });

  it('rejects tickers without a usable price', () => {
    const base = {
      exchange: 'binance-spot' as const,
      kind: 'spot' as const,
      rawSymbol: 'X',
      base: 'X',
      quote: 'USDT',
      timestamp: 0,
    };
    expect(toTicker({ ...base, price: null })).toBeNull();
    expect(toTicker({ ...base, price: 0 })).toBeNull();
    expect(toTicker({ ...base, price: 1 })?.price).toBe(1);
  });

  it('sorts, de-duplicates and filters malformed candles', () => {
    const candles = normaliseCandles([
      { time: 3, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 },
      { time: 1, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 },
      { time: 3, open: 9, high: 9, low: 9, close: 9, volume: 9 },
      { time: 4, open: 1, high: 1, low: 1, close: 0, volume: 1 },
      { time: Number.NaN, open: 1, high: 1, low: 1, close: 1, volume: 1 },
    ]);
    expect(candles.map((candle) => candle.time)).toEqual([1, 3]);
    expect(candles[1].close).toBe(9);
  });

  it('orders order-book ladders from best price outwards', () => {
    expect(parseLevels([['100', '1'], ['102', '2'], ['101', '3']], 'bid', 2)).toEqual([
      { price: 102, qty: 2 },
      { price: 101, qty: 3 },
    ]);
    expect(parseLevels([['103', '1'], ['101', '2']], 'ask', 5)).toEqual([
      { price: 101, qty: 2 },
      { price: 103, qty: 1 },
    ]);
    expect(parseLevels('nope', 'ask', 5)).toEqual([]);
  });

  it('snaps requested depth to the venue-supported value', () => {
    expect(pickBookDepth(15, [5, 10, 20, 50])).toBe(20);
    expect(pickBookDepth(100, [1, 50, 200, 500])).toBe(200);
    expect(pickBookDepth(2000, [5, 10, 20])).toBe(20);
  });

  it('maps Bybit intervals to their API codes', () => {
    expect(BYBIT_INTERVALS['1h']).toBe('60');
    expect(BYBIT_INTERVALS['1w']).toBe('W');
  });

  it('converts Bybit ratios to percent', () => {
    expect(bybitPercentToPercent('0.0204')).toBeCloseTo(2.04, 5);
    expect(bybitPercentToPercent(undefined)).toBeNull();
  });
});

describe('binance spot adapter', () => {
  it('maps live payloads and drops non-trading symbols', async () => {
    stubFetch([
      ['/api/v3/exchangeInfo', BINANCE_EXCHANGE_INFO],
      ['/api/v3/ticker/24hr', BINANCE_TICKERS],
    ]);
    const tickers = await binanceSpot.fetchTickers();
    expect(tickers).toHaveLength(2);
    const btc = tickers.find((ticker) => ticker.rawSymbol === 'BTCUSDT')!;
    expect(btc.price).toBeCloseTo(65000.1, 4);
    expect(btc.changePercent24h).toBeCloseTo(2.1, 5);
    expect(btc.bid).toBeCloseTo(65000, 4);
    expect(btc.ask).toBeCloseTo(65000.2, 4);
    expect(btc.symbol).toBe('BTC/USDT');
    expect(btc.timestamp).toBe(1_700_000_000_000);
    expect(tickers.some((ticker) => ticker.rawSymbol === 'DELISTEDUSDT')).toBe(false);
  });

  it('normalises klines into ascending candles', async () => {
    stubFetch([['/api/v3/klines', BINANCE_KLINES]]);
    const candles = await binanceSpot.fetchKlines('BTCUSDT', '1h', 2);
    expect(candles).toHaveLength(2);
    expect(candles[0].time).toBe(1_700_000_000);
    expect(candles[1].close).toBe(65000);
  });

  it('parses the order book with cumulative-ready levels', async () => {
    stubFetch([['/api/v3/depth', BINANCE_DEPTH]]);
    const book = await binanceSpot.fetchOrderBook('BTCUSDT', 15);
    expect(book.bids[0]).toEqual({ price: 64999, qty: 1.5 });
    expect(book.asks[0]).toEqual({ price: 65003, qty: 1 });
    expect(book.exchange).toBe('binance-spot');
  });

  it('never reports a funding rate for spot', async () => {
    expect(await binanceSpot.fetchFunding('BTCUSDT')).toBeNull();
    expect(await binanceSpot.fetchFundingHistory('BTCUSDT', 10)).toEqual([]);
  });

  it('surfaces HTTP failures as typed errors', async () => {
    stubFetch([]);
    await expect(binanceSpot.fetchKlines('BTCUSDT', '1h', 2)).rejects.toThrow();
  });
});

describe('binance futures adapter', () => {
  it('merges 24h stats with funding and mark price', async () => {
    stubFetch([
      ['/fapi/v1/exchangeInfo', BINANCE_FUT_INFO],
      ['/fapi/v1/ticker/24hr', BINANCE_FUT_TICKERS],
      ['/fapi/v1/premiumIndex', BINANCE_PREMIUM],
    ]);
    const tickers = await binanceFutures.fetchTickers();
    expect(tickers).toHaveLength(1);
    const btc = tickers[0];
    expect(btc.kind).toBe('futures');
    expect(btc.fundingRate).toBeCloseTo(0.0001, 8);
    expect(btc.markPrice).toBeCloseTo(65018.5, 4);
    expect(btc.nextFundingTime).toBe(1_700_003_600_000);
  });

  it('returns a funding snapshot for a single contract', async () => {
    stubFetch([['/fapi/v1/premiumIndex', { ...BINANCE_PREMIUM[0] }]]);
    const snapshot = await binanceFutures.fetchFunding('BTCUSDT');
    expect(snapshot?.rate).toBeCloseTo(0.0001, 8);
    expect(snapshot?.intervalHours).toBe(8);
  });

  it('maps funding history', async () => {
    stubFetch([
      [
        '/fapi/v1/fundingRate',
        [
          { fundingTime: 1_700_000_000_000, fundingRate: '0.0002' },
          { fundingTime: 1_699_971_200_000, fundingRate: '-0.0001' },
        ],
      ],
    ]);
    const history = await binanceFutures.fetchFundingHistory('BTCUSDT', 10);
    expect(history).toHaveLength(2);
    expect(history[0].rate).toBeCloseTo(-0.0001, 8);
    expect(history[1].rate).toBeCloseTo(0.0002, 8);
  });
});

describe('bybit adapters', () => {
  it('converts ratio percentages and joins instrument metadata', async () => {
    stubFetch([
      ['/v5/market/instruments-info', BYBIT_INSTRUMENTS],
      ['/v5/market/tickers', BYBIT_TICKERS],
    ]);
    const { bybitSpot } = await import('./bybitSpot');
    const tickers = await bybitSpot.fetchTickers();
    expect(tickers).toHaveLength(1);
    expect(tickers[0].changePercent24h).toBeCloseTo(2.04, 5);
    expect(tickers[0].base).toBe('BTC');
  });

  it('reverses Bybit klines into ascending order', async () => {
    stubFetch([['/v5/market/kline', BYBIT_KLINES]]);
    const { bybitSpot } = await import('./bybitSpot');
    const candles = await bybitSpot.fetchKlines('BTCUSDT', '1h', 2);
    expect(candles.map((candle) => candle.time)).toEqual([1_700_000_000, 1_700_003_600]);
    expect(candles[1].close).toBe(65000);
  });

  it('exposes funding for linear perpetuals only', async () => {
    stubFetch([['/v5/market/tickers', BYBIT_LINEAR_TICKERS]]);
    const snapshot = await bybitLinear.fetchFunding('BTCUSDT');
    expect(snapshot?.rate).toBeCloseTo(-0.0002, 8);
    expect(snapshot?.nextFundingTime).toBe(1_700_003_600_000);
  });

  it('throws on a non-zero retCode instead of showing empty data', async () => {
    stubFetch([['/v5/market/tickers', { retCode: 10001, retMsg: 'params error', result: {} }]]);
    const { bybitSpot } = await import('./bybitSpot');
    await expect(bybitSpot.fetchTickers()).rejects.toThrow(/retCode 10001/);
  });
});
