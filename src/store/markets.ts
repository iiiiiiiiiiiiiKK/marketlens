import { create } from 'zustand';
import type { ExchangeId, MarketTicker, SourceState } from '../lib/types';
import { EXCHANGE_IDS } from '../data';

function emptySource(): SourceState {
  return { status: 'idle', tickers: [], updatedAt: null, error: null, refreshing: false };
}

function initialState(): Record<ExchangeId, SourceState> {
  const record = {} as Record<ExchangeId, SourceState>;
  for (const id of EXCHANGE_IDS) record[id] = emptySource();
  return record;
}

export interface MarketsState {
  sources: Record<ExchangeId, SourceState>;
  /** Timestamp of the most recent successful update across all sources. */
  lastSuccessAt: number | null;
  markLoading: (id: ExchangeId) => void;
  markSuccess: (id: ExchangeId, tickers: MarketTicker[]) => void;
  markError: (id: ExchangeId, reason: string) => void;
  reset: () => void;
}

export const useMarkets = create<MarketsState>()((set) => ({
  sources: initialState(),
  lastSuccessAt: null,
  markLoading: (id) =>
    set((state) => {
      const previous = state.sources[id];
      return {
        sources: {
          ...state.sources,
          [id]: {
            ...previous,
            refreshing: true,
            // Keep showing the last good rows (clearly marked stale) instead of
            // blanking the table on a transient error.
            status: previous.status === 'ready' ? 'ready' : 'loading',
          },
        },
      };
    }),
  markSuccess: (id, tickers) =>
    set((state) => ({
      sources: {
        ...state.sources,
        [id]: { status: 'ready', tickers, updatedAt: Date.now(), error: null, refreshing: false },
      },
      lastSuccessAt: Date.now(),
    })),
  markError: (id, reason) =>
    set((state) => {
      const previous = state.sources[id];
      return {
        sources: {
          ...state.sources,
          [id]: {
            ...previous,
            refreshing: false,
            error: reason,
            // Keep stale rows visible but flag the source as failed.
            status: previous.tickers.length > 0 ? 'error' : 'error',
            tickers: previous.tickers,
          },
        },
      };
    }),
  reset: () => set({ sources: initialState(), lastSuccessAt: null }),
}));

export function flattenTickers(sources: Record<ExchangeId, SourceState>): MarketTicker[] {
  const out: MarketTicker[] = [];
  for (const id of EXCHANGE_IDS) {
    const source = sources[id];
    if (!source) continue;
    out.push(...source.tickers);
  }
  return out;
}

export function tickerIndex(sources: Record<ExchangeId, SourceState>): Map<string, MarketTicker> {
  const map = new Map<string, MarketTicker>();
  for (const ticker of flattenTickers(sources)) map.set(ticker.id, ticker);
  return map;
}

export function okSourceCount(sources: Record<ExchangeId, SourceState>): number {
  return EXCHANGE_IDS.filter((id) => sources[id]?.status === 'ready').length;
}

export function errorSources(sources: Record<ExchangeId, SourceState>): Array<{ id: ExchangeId; error: string }> {
  return EXCHANGE_IDS.filter((id) => sources[id]?.status === 'error').map((id) => ({
    id,
    error: sources[id].error ?? 'unknown',
  }));
}
