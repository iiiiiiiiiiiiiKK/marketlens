import { useEffect, useState } from 'react';
import { acquireLiveTicker } from '../data/liveTicker';
import type { LiveUpdate, StreamStatus } from '../data/liveTicker';
import type { ExchangeId } from '../lib/types';

interface UseLiveTickerResult {
  live: LiveUpdate | null;
  streamStatus: StreamStatus;
}

/**
 * Subscribes to the exchange websocket for one market. Unsubscribing on unmount
 * (or when the market changes) closes the socket, so no orphan connections stay
 * open while the user browses.
 */
export function useLiveTicker(exchange: ExchangeId | null, rawSymbol: string | null): UseLiveTickerResult {
  const [live, setLive] = useState<LiveUpdate | null>(null);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>('closed');

  useEffect(() => {
    setLive(null);
    if (!exchange || !rawSymbol) {
      setStreamStatus('closed');
      return;
    }
    const connection = acquireLiveTicker(exchange, rawSymbol);
    const unsubscribe = connection.subscribe(setLive, setStreamStatus);
    return () => {
      unsubscribe();
      setLive(null);
    };
  }, [exchange, rawSymbol]);

  return { live, streamStatus };
}
