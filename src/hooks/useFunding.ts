import { useEffect, useRef, useState } from 'react';
import { getAdapter } from '../data';
import { describeHttpError } from '../lib/http';
import type { ExchangeId, FundingHistoryPoint, FundingSnapshot } from '../lib/types';
import { useSettings } from '../store/settings';
import type { FetchStatus } from './useKlines';

interface UseFundingResult {
  snapshot: FundingSnapshot | null;
  history: FundingHistoryPoint[];
  status: FetchStatus;
  error: string | null;
}

const SNAPSHOT_MS = 30_000;
const HISTORY_MS = 5 * 60_000;

/**
 * Funding is only defined for perpetual futures. For spot markets the adapter
 * returns `null` and the UI shows an explicit "not applicable" state instead of
 * a fabricated number.
 */
export function useFunding(exchange: ExchangeId | null, rawSymbol: string | null, enabled = true): UseFundingResult {
  const [snapshot, setSnapshot] = useState<FundingSnapshot | null>(null);
  const [history, setHistory] = useState<FundingHistoryPoint[]>([]);
  const [status, setStatus] = useState<FetchStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const paused = useSettings((state) => state.paused);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!exchange || !rawSymbol || !enabled) {
      setSnapshot(null);
      setHistory([]);
      setStatus('idle');
      setError(null);
      return;
    }
    const adapter = getAdapter(exchange);
    const controller = new AbortController();
    setSnapshot(null);
    setHistory([]);
    setError(null);

    const loadSnapshot = async () => {
      try {
        const next = await adapter.fetchFunding(rawSymbol, controller.signal);
        if (!alive.current || controller.signal.aborted) return;
        setSnapshot(next);
        setStatus('ready');
        setError(null);
      } catch (caught) {
        if (!alive.current || controller.signal.aborted) return;
        setError(describeHttpError(caught));
        setStatus('error');
      }
    };

    let loadedHistory = false;
    const loadHistory = async () => {
      try {
        const rows = await adapter.fetchFundingHistory(rawSymbol, 60, controller.signal);
        if (!alive.current || controller.signal.aborted) return;
        setHistory(rows);
        loadedHistory = true;
      } catch {
        if (alive.current) setHistory([]);
      }
    };

    void loadSnapshot();
    void loadHistory();

    let timer: ReturnType<typeof setInterval> | null = null;
    if (!paused) {
      timer = setInterval(() => {
        if (document.visibilityState === 'hidden') return;
        void loadSnapshot();
        if (!loadedHistory) void loadHistory();
      }, SNAPSHOT_MS);
    }

    return () => {
      controller.abort();
      if (timer) clearInterval(timer);
    };
  }, [exchange, rawSymbol, enabled, paused]);

  // Funding history rarely changes; refresh it on a slow cadence.
  useEffect(() => {
    if (!exchange || !rawSymbol || !enabled || paused) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void getAdapter(exchange)
        .fetchFundingHistory(rawSymbol, 60)
        .then((rows) => alive.current && setHistory(rows))
        .catch(() => undefined);
    }, HISTORY_MS);
    return () => clearInterval(timer);
  }, [exchange, rawSymbol, enabled, paused]);

  return { snapshot, history, status, error };
}
