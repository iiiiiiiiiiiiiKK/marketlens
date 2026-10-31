/** Shared domain types for MarketLens. */

export type ExchangeId = 'binance-spot' | 'binance-futures' | 'bybit-spot' | 'bybit-linear';

export type MarketKind = 'spot' | 'futures';

export type ChartInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';

export const CHART_INTERVALS: ChartInterval[] = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'];

/** A single normalised OHLCV candle. `time` is seconds (UNIX). */
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Normalised ticker row, one per market on one exchange. */
export interface MarketTicker {
  exchange: ExchangeId;
  kind: MarketKind;
  /** Canonical id: `${exchange}:${rawSymbol}` */
  id: string;
  /** Exchange-native symbol, e.g. BTCUSDT */
  rawSymbol: string;
  /** Display symbol, e.g. BTC/USDT */
  symbol: string;
  base: string;
  quote: string;
  price: number;
  changePercent24h: number | null;
  high24h: number | null;
  low24h: number | null;
  /** Base-asset volume over 24h. */
  volume24h: number | null;
  /** Quote-asset (turnover) volume over 24h. */
  quoteVolume24h: number | null;
  bid: number | null;
  ask: number | null;
  /** Perpetual funding rate as a ratio (0.0001 = 0.01%). */
  fundingRate: number | null;
  nextFundingTime: number | null;
  markPrice: number | null;
  /** Exchange timestamp of the data, ms. */
  timestamp: number;
  /** Local time the data was received, ms. */
  fetchedAt: number;
}

export interface OrderBookLevel {
  price: number;
  qty: number;
}

export interface OrderBook {
  exchange: ExchangeId;
  rawSymbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  /** Exchange timestamp in ms, when provided. */
  timestamp: number;
  fetchedAt: number;
}

export interface FundingSnapshot {
  rate: number | null;
  nextFundingTime: number | null;
  markPrice: number | null;
  indexPrice: number | null;
  intervalHours: number | null;
}

export interface FundingHistoryPoint {
  time: number;
  rate: number;
}

/** Instrument metadata coming from the exchange symbol directory. */
export interface InstrumentMeta {
  rawSymbol: string;
  base: string;
  quote: string;
  status: string;
}

export type SourceStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface SourceState {
  status: SourceStatus;
  tickers: MarketTicker[];
  /** Last successful update, ms epoch. */
  updatedAt: number | null;
  error: string | null;
  /** True while a refresh is in flight. */
  refreshing: boolean;
}
