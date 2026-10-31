import { describe, expect, it } from 'vitest';
import { DEFAULT_ROUTE, parseHash, toHash } from './router';

describe('parseHash', () => {
  it('defaults to the markets view', () => {
    expect(parseHash('')).toEqual(DEFAULT_ROUTE);
    expect(parseHash('#/')).toEqual(DEFAULT_ROUTE);
  });

  it('parses simple views', () => {
    expect(parseHash('#/spot').view).toBe('spot');
    expect(parseHash('#/futures').view).toBe('futures');
    expect(parseHash('#/watchlist').view).toBe('watchlist');
    expect(parseHash('#/settings').view).toBe('settings');
  });

  it('parses pair deep links', () => {
    const route = parseHash('#/pair/bybit-linear/ethusdt');
    expect(route).toMatchObject({ view: 'pair', exchange: 'bybit-linear', rawSymbol: 'ETHUSDT' });
  });

  it('rejects unknown venues and falls back', () => {
    expect(parseHash('#/pair/kraken/BTCUSDT').view).toBe('markets');
  });

  it('parses compare query params', () => {
    const route = parseHash('#/compare?pair=ETH%2FUSDT');
    expect(route.view).toBe('compare');
    expect(route.comparePair).toBe('ETH/USDT');
  });

  it('ignores unknown views', () => {
    expect(parseHash('#/nonsense').view).toBe('markets');
  });
});

describe('toHash', () => {
  it('round-trips pair routes', () => {
    const hash = toHash({ view: 'pair', exchange: 'binance-futures', rawSymbol: 'BTCUSDT', comparePair: null });
    expect(hash).toBe('#/pair/binance-futures/BTCUSDT');
    expect(parseHash(hash)).toMatchObject({ exchange: 'binance-futures', rawSymbol: 'BTCUSDT' });
  });

  it('keeps the compare pair', () => {
    const hash = toHash({ view: 'compare', exchange: null, rawSymbol: null, comparePair: 'BTC/USDT' });
    expect(parseHash(hash).comparePair).toBe('BTC/USDT');
  });
});
