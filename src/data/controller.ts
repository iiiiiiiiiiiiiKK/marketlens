import { ADAPTER_MAP, EXCHANGE_IDS } from './index';
import { describeHttpError } from '../lib/http';
import type { ExchangeId } from '../lib/types';
import { useMarkets } from '../store/markets';
import { useSettings } from '../store/settings';

/**
 * Owns the refresh loop. One HTTP request per source at a time, sequential
 * scheduling (never two overlapping ticks), automatic back-off when the browser
 * is offline or the tab is hidden, and independent error handling per venue so a
 * single exchange outage cannot take the dashboard down.
 */

const inflight = new Map<ExchangeId, Promise<void>>();
let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;
let consecutiveFailures = 0;

export async function refreshSource(id: ExchangeId): Promise<void> {
  const existing = inflight.get(id);
  if (existing) return existing;
  const { markLoading, markSuccess, markError } = useMarkets.getState();
  markLoading(id);
  const task = (async () => {
    try {
      const tickers = await ADAPTER_MAP[id].fetchTickers();
      if (tickers.length === 0) {
        markError(id, 'bad-payload');
        return;
      }
      markSuccess(id, tickers);
    } catch (error) {
      markError(id, describeHttpError(error));
    }
  })();
  inflight.set(id, task);
  try {
    await task;
  } finally {
    inflight.delete(id);
  }
}

export async function refreshAll(): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  const results = await Promise.allSettled(EXCHANGE_IDS.map((id) => refreshSource(id)));
  const failed = results.filter((result) => result.status === 'rejected').length;
  consecutiveFailures = failed === results.length ? consecutiveFailures + 1 : 0;
}

function nextDelay(baseMs: number): number {
  // Gentle back-off after repeated total failures, capped at 4x the interval.
  const multiplier = Math.min(2 ** consecutiveFailures, 4);
  return baseMs * multiplier;
}

function schedule() {
  if (!started) return;
  if (timer) clearTimeout(timer);
  const state = useSettings.getState();
  const delay = nextDelay(state.refreshIntervalMs);
  timer = setTimeout(() => {
    void tick();
  }, delay);
}

async function tick() {
  const { paused } = useSettings.getState();
  const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
  if (!paused && !hidden) await refreshAll();
  if (started) schedule();
}

export function startPolling(): void {
  if (started) return;
  started = true;
  void tick();
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('online', onOnline);
  }
}

export function stopPolling(): void {
  started = false;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', onVisibilityChange);
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('online', onOnline);
  }
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible' && !useSettings.getState().paused) {
    void refreshAll().then(schedule);
  }
}

function onOnline() {
  void refreshAll().then(schedule);
}

/** Re-schedules the loop after the user changes the interval or pause state. */
export function reschedulePolling(): void {
  if (!started) return;
  schedule();
}

export function isPolling(): boolean {
  return started;
}
