import { useCallback, useEffect, useRef, useState } from 'react';
import { getAdapter } from '../data';
import { describeHttpError } from '../lib/http';
import type { ExchangeId, OrderBook } from '../lib/types';
import { useSettings } from '../store/settings';
import type { FetchStatus } from './useKlines';

interface UseOrderBookResult {
  book: OrderBook | null;
  status: FetchStatus;
  error: string | null;
  reload: () => void;
}

export function useOrderBook(
  exchange: ExchangeId | null,
  rawSymbol: string | null,
  depth: number,
  enabled = true,
): UseOrderBookResult {
  const [book, setBook] = useState<OrderBook | null>(null);
  const [status, setStatus] = useState<FetchStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const intervalMs = useSettings((state) => state.refreshIntervalMs);
  const paused = useSettings((state) => state.paused);
  const requestId = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (quiet = false) => {
      if (!exchange || !rawSymbol || !enabled) return;
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      const current = ++requestId.current;
      if (!quiet) setStatus((prev) => (prev === 'ready' ? 'ready' : 'loading'));
      try {
        const next = await getAdapter(exchange).fetchOrderBook(rawSymbol, depth, controller.signal);
        if (current !== requestId.current) return;
        setBook(next);
        setStatus('ready');
        setError(null);
      } catch (caught) {
        if (current !== requestId.current || controller.signal.aborted) return;
        setError(describeHttpError(caught));
        setStatus('error');
      }
    },
    [exchange, rawSymbol, depth, enabled],
  );

  useEffect(() => {
    if (!exchange || !rawSymbol || !enabled) {
      setBook(null);
      setStatus('idle');
      return;
    }
    setBook(null);
    void load(false);
    return () => controllerRef.current?.abort();
  }, [exchange, rawSymbol, depth, enabled, nonce, load]);

  useEffect(() => {
    if (!exchange || !rawSymbol || !enabled || paused) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void load(true);
    }, Math.max(3_000, intervalMs));
    return () => clearInterval(timer);
  }, [exchange, rawSymbol, enabled, paused, intervalMs, load]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  return { book, status, error, reload };
}
