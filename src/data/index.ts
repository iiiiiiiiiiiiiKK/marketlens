import type { ChartInterval, ExchangeId, MarketKind } from '../lib/types';
import type { MarketAdapter } from './base';
import { binanceSpot } from './binanceSpot';
import { binanceFutures } from './binanceFutures';
import { bybitSpot } from './bybitSpot';
import { bybitLinear } from './bybitLinear';

export const ADAPTERS: MarketAdapter[] = [binanceSpot, binanceFutures, bybitSpot, bybitLinear];

export const ADAPTER_MAP: Record<ExchangeId, MarketAdapter> = {
  'binance-spot': binanceSpot,
  'binance-futures': binanceFutures,
  'bybit-spot': bybitSpot,
  'bybit-linear': bybitLinear,
};

export const EXCHANGE_IDS = ADAPTERS.map((adapter) => adapter.id);

export function getAdapter(id: ExchangeId): MarketAdapter {
  return ADAPTER_MAP[id];
}

const LABELS: Record<ExchangeId, { en: string; zh: string; short: string }> = {
  'binance-spot': { en: 'Binance Spot', zh: 'Binance 现货', short: 'BN-S' },
  'binance-futures': { en: 'Binance Perp', zh: 'Binance 永续', short: 'BN-F' },
  'bybit-spot': { en: 'Bybit Spot', zh: 'Bybit 现货', short: 'BB-S' },
  'bybit-linear': { en: 'Bybit Perp', zh: 'Bybit 永续', short: 'BB-F' },
};

export function sourceLabel(id: ExchangeId, lang: 'en' | 'zh' = 'en'): string {
  return LABELS[id][lang];
}

export function sourceShortLabel(id: ExchangeId): string {
  return LABELS[id].short;
}

export function sourcesByKind(kind: MarketKind): ExchangeId[] {
  return ADAPTERS.filter((adapter) => adapter.kind === kind).map((adapter) => adapter.id);
}

/** Parses a canonical id ("bybit-spot:BTCUSDT") back into its parts. */
export function parseTickerId(id: string): { exchange: ExchangeId; rawSymbol: string } | null {
  const separator = id.indexOf(':');
  if (separator <= 0) return null;
  const exchange = id.slice(0, separator) as ExchangeId;
  const rawSymbol = id.slice(separator + 1);
  if (!(exchange in ADAPTER_MAP) || !rawSymbol) return null;
  return { exchange, rawSymbol };
}

/** Intervals supported by every adapter (used for "all sources" chart hints). */
export function commonIntervals(): ChartInterval[] {
  const first = ADAPTERS[0].intervals;
  return first.filter((interval) => ADAPTERS.every((adapter) => adapter.intervals.includes(interval)));
}
