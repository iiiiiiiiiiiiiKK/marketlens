import { describe, expect, it } from 'vitest';
import {
  buildCompare,
  comparablePairs,
  filterTickers,
  findReferenceTicker,
  marketBreadth,
  matchesQuery,
  normaliseQuery,
  quoteOptions,
  sortTickers,
  topMovers,
} from './selectors';
import { SAMPLE_TICKERS, makeTicker } from '../test/fixtures';

describe('query matching', () => {
  it('normalises symbol queries', () => {
    expect(normaliseQuery(' btc/usdt ')).toBe('BTCUSDT');
  });

  it('matches on display symbol, raw symbol and base asset', () => {
    const ticker = makeTicker();
    expect(matchesQuery(ticker, 'BTC/USDT')).toBe(true);
    expect(matchesQuery(ticker, 'btcusdt')).toBe(true);
    expect(matchesQuery(ticker, 'btc')).toBe(true);
    expect(matchesQuery(ticker, 'ETH')).toBe(false);
    expect(matchesQuery(ticker, '')).toBe(true);
  });
});

describe('filterTickers', () => {
  it('filters by exchange, kind and quote', () => {
    const result = filterTickers(SAMPLE_TICKERS, {
      query: '',
      exchanges: ['binance-spot'],
      kinds: ['spot'],
      quotes: ['USDT'],
    });
    expect(result.map((ticker) => ticker.rawSymbol).sort()).toEqual(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);
  });

  it('returns everything with empty filters', () => {
    expect(filterTickers(SAMPLE_TICKERS, { query: '', exchanges: [], kinds: [], quotes: [] })).toHaveLength(
      SAMPLE_TICKERS.length,
    );
  });

  it('supports favourites-only mode', () => {
    const result = filterTickers(SAMPLE_TICKERS, {
      query: '',
      exchanges: [],
      kinds: [],
      quotes: [],
      favoritesOnly: ['bybit-linear:BTCUSDT'],
    });
    expect(result).toHaveLength(1);
    expect(result[0].exchange).toBe('bybit-linear');
  });
});

describe('sortTickers', () => {
  it('sorts numeric columns descending', () => {
    const sorted = sortTickers(SAMPLE_TICKERS, 'quoteVolume24h', 'desc');
    const volumes = sorted.map((ticker) => ticker.quoteVolume24h ?? 0);
    expect([...volumes].sort((a, b) => b - a)).toEqual(volumes);
  });

  it('keeps missing values at the bottom in both directions', () => {
    const tickers = [
      makeTicker({ rawSymbol: 'AAAUSDT', symbol: 'AAA/USDT', changePercent24h: 1 }),
      makeTicker({ rawSymbol: 'BBBUSDT', symbol: 'BBB/USDT', changePercent24h: null }),
      makeTicker({ rawSymbol: 'CCCUSDT', symbol: 'CCC/USDT', changePercent24h: -2 }),
    ];
    const asc = sortTickers(tickers, 'changePercent24h', 'asc');
    expect(asc[asc.length - 1].symbol).toBe('BBB/USDT');
    const desc = sortTickers(tickers, 'changePercent24h', 'desc');
    expect(desc[desc.length - 1].symbol).toBe('BBB/USDT');
  });

  it('falls back to turnover when no sort is selected', () => {
    const sorted = sortTickers(SAMPLE_TICKERS, null, 'desc');
    expect(sorted[0].quoteVolume24h).toBeGreaterThanOrEqual(sorted[1].quoteVolume24h ?? 0);
  });
});

describe('marketBreadth', () => {
  it('counts only USDT spot pairs', () => {
    const breadth = marketBreadth(SAMPLE_TICKERS);
    expect(breadth.advancing).toBe(3); // BTC, SOL (binance+?), ETH declines
    expect(breadth.declining).toBe(1);
    expect(breadth.turnover).toBeGreaterThan(0);
  });

  it('ignores perpetual markets to avoid double counting', () => {
    const perpsOnly = SAMPLE_TICKERS.filter((ticker) => ticker.kind === 'futures');
    expect(marketBreadth(perpsOnly).total).toBe(0);
  });
});

describe('topMovers', () => {
  it('returns gainers and losers ordered by change', () => {
    const movers = topMovers(SAMPLE_TICKERS, 2);
    expect(movers.gainers[0].base).toBe('SOL');
    expect(movers.losers[0].base).toBe('ETH');
  });
});

describe('buildCompare', () => {
  it('compares venues quoting the same pair', () => {
    const result = buildCompare(SAMPLE_TICKERS, 'BTC', 'USDT');
    expect(result.rows).toHaveLength(4);
    expect(result.sameQuote).toBe(true);
    expect(result.kindMismatch).toBe(true); // spot + perp present
    expect(result.medianPrice).not.toBeNull();
    expect(result.bestAsk?.ticker.exchange).toBe('binance-spot');
    expect(result.bestBid?.ticker.exchange).toBe('bybit-spot');
  });

  it('computes the median only from the requested quote asset', () => {
    const result = buildCompare(SAMPLE_TICKERS, 'BTC', 'USDC');
    expect(result.rows).toHaveLength(1);
    expect(result.sameQuote).toBe(true);
    expect(result.kindMismatch).toBe(false);
  });

  it('marks a single-venue pair', () => {
    const result = buildCompare(SAMPLE_TICKERS, 'SOL', 'USDT');
    expect(result.rows).toHaveLength(1);
  });
});

describe('discovery helpers', () => {
  it('lists pairs with at least two venues', () => {
    const pairs = comparablePairs(SAMPLE_TICKERS);
    expect(pairs[0]).toMatchObject({ base: 'BTC', quote: 'USDT' });
    expect(pairs.some((pair) => pair.base === 'SOL')).toBe(false);
  });

  it('sorts quote assets by frequency', () => {
    expect(quoteOptions(SAMPLE_TICKERS)[0]).toBe('USDT');
  });

  it('prefers Binance spot as the reference venue', () => {
    expect(findReferenceTicker(SAMPLE_TICKERS, 'BTC')?.exchange).toBe('binance-spot');
    expect(findReferenceTicker(SAMPLE_TICKERS, 'NOPE')).toBeNull();
  });
});
