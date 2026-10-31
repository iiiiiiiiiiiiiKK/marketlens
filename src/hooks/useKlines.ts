import { useCallback, useEffect, useRef, useState } from 'react';
import { getAdapter } from '../data';
import { describeHttpError } from '../lib/http';
import type { Candle, ChartInterval, ExchangeId } from '../lib/types';
import { useSettings } from '../store/settings';

export type FetchStatus = 'idle' | 'loading' | 'ready' | 'error';

interface UseKlinesResult {
  candles: Candle[];
  status: FetchStatus;
  error: string | null;
  reload: () => void;
}

const HISTORY_LIMIT = 500;
/** Full refetch cadence: fast enough to stay correct, slow enough to be polite. */
const FULL_REFRESH_MS = 60_000;

/** Loads real OHLCV candles for a market and keeps them fresh. */
export function useKlines(
  exchange: ExchangeId | null,
  rawSymbol: string | null,
  interval: ChartInterval,
  enabled = true,
): UseKlinesResult {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [status, setStatus] = useState<FetchStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const paused = useSettings((state) => state.paused);
  const requestId = useRef(0);

  const load = useCallback(
    async (signal: AbortSignal, quiet = false) => {
      if (!exchange || !rawSymbol || !enabled) return;
      const current = ++requestId.current;
      if (!quiet) setStatus((prev) => (prev === 'ready' ? 'ready' : 'loading'));
      try {
        const rows = await getAdapter(exchange).fetchKlines(rawSymbol, interval, HISTORY_LIMIT, signal);
        if (current !== requestId.current) return;
        setCandles(rows);
        setStatus('ready');
        setError(null);
      } catch (caught) {
        if (current !== requestId.current) return;
        if (signal.aborted) return;
        setError(describeHttpError(caught));
        setStatus('error');
      }
    },
    [exchange, rawSymbol, interval, enabled],
  );

  useEffect(() => {
    if (!exchange || !rawSymbol || !enabled) {
      setCandles([]);
      setStatus('idle');
      setError(null);
      return;
    }
    const controller = new AbortController();
    setCandles([]);
    void load(controller.signal);
    return () => controller.abort();
  }, [exchange, rawSymbol, interval, enabled, load, nonce]);

  useEffect(() => {
    if (!exchange || !rawSymbol || !enabled || paused) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      const controller = new AbortController();
      void load(controller.signal, true);
    }, FULL_REFRESH_MS);
    return () => clearInterval(timer);
  }, [exchange, rawSymbol, enabled, paused, load]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  return { candles, status, error, reload };
}
