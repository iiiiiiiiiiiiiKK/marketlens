import { BYBIT_BASE, createBybitFundingHistory, createBybitKlines, createBybitOrderBook, createBybitTickersLoader } from './bybit';
import { getJson, num } from '../lib/http';
import type { FundingSnapshot } from '../lib/types';
import type { InstrumentCacheEntry, MarketAdapter } from './base';

const cache: { current: InstrumentCacheEntry | null } = { current: null };

interface LinearTicker {
  symbol: string;
  fundingRate?: string;
  nextFundingTime?: string;
  markPrice?: string;
  indexPrice?: string;
}

export const bybitLinear: MarketAdapter = {
  id: 'bybit-linear',
  label: 'Bybit',
  kind: 'futures',
  endpoint: BYBIT_BASE,
  docsUrl: 'https://bybit-exchange.github.io/docs/v5/intro',
  intervals: ['1m', '5m', '15m', '1h', '4h', '1d', '1w'],
  bookDepths: [1, 50, 200, 500],
  fetchTickers: createBybitTickersLoader('linear', cache),
  fetchKlines: createBybitKlines('linear'),
  fetchOrderBook: createBybitOrderBook('linear', 'bybit-linear'),
  fetchFundingHistory: createBybitFundingHistory(),

  async fetchFunding(rawSymbol, signal): Promise<FundingSnapshot | null> {
    const url = `${BYBIT_BASE}/v5/market/tickers?category=linear&symbol=${encodeURIComponent(rawSymbol)}`;
    const body = await getJson<{
      retCode: number;
      retMsg: string;
      result: { list: LinearTicker[] };
    }>(url, { signal });
    if (body.retCode !== 0) return null;
    const row = body.result?.list?.[0];
    if (!row) return null;
    const next = num(row.nextFundingTime);
    return {
      rate: num(row.fundingRate),
      nextFundingTime: next && next > 0 ? next : null,
      markPrice: num(row.markPrice),
      indexPrice: num(row.indexPrice),
      intervalHours: null,
    };
  },
};
