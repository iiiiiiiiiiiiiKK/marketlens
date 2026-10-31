import type { FundingHistoryPoint, FundingSnapshot } from '../lib/types';
import type { InstrumentCacheEntry, MarketAdapter } from './base';
import {
  BYBIT_BOOK_DEPTHS,
  createBybitKlines,
  createBybitOrderBook,
  createBybitTickersLoader,
} from './bybit';

const cache: { current: InstrumentCacheEntry | null } = { current: null };

export const bybitSpot: MarketAdapter = {
  id: 'bybit-spot',
  label: 'Bybit',
  kind: 'spot',
  endpoint: 'https://api.bybit.com',
  docsUrl: 'https://bybit-exchange.github.io/docs/v5/intro',
  intervals: ['1m', '5m', '15m', '1h', '4h', '1d', '1w'],
  bookDepths: BYBIT_BOOK_DEPTHS,
  fetchTickers: createBybitTickersLoader('spot', cache),
  fetchKlines: createBybitKlines('spot'),
  fetchOrderBook: createBybitOrderBook('spot', 'bybit-spot'),
  async fetchFunding(): Promise<FundingSnapshot | null> {
    // Spot has no funding. Reporting one would be fabricated data.
    return null;
  },
  async fetchFundingHistory(): Promise<FundingHistoryPoint[]> {
    return [];
  },
};
