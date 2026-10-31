import type { ExchangeId } from '../lib/types';
import { num } from '../lib/http';

export interface LiveUpdate {
  price: number;
  changePercent24h: number | null;
  high24h: number | null;
  low24h: number | null;
  volume24h: number | null;
  quoteVolume24h: number | null;
  fundingRate: number | null;
  nextFundingTime: number | null;
  timestamp: number;
}

export type StreamStatus = 'connecting' | 'open' | 'reconnecting' | 'closed' | 'unsupported';

interface StreamConfig {
  url: (rawSymbol: string) => string;
  /** Messages to send once the socket opens (Bybit needs an explicit subscribe). */
  subscribe: ((rawSymbol: string) => string | null) | null;
  ping: { intervalMs: number; payload: string } | null;
  /** Bybit answers pings with {"op":"pong"} and flushes ticker frames. */
  parse: (rawSymbol: string, payload: unknown) => LiveUpdate | null;
}

function binanceMiniTickerParse(rawSymbol: string, payload: unknown): LiveUpdate | null {
  if (!payload || typeof payload !== 'object') return null;
  const data = payload as Record<string, unknown>;
  if (data.e !== '24hrMiniTicker') return null;
  if (typeof data.s === 'string' && data.s !== rawSymbol) return null;
  const close = num(data.c);
  const open = num(data.o);
  if (close === null || close <= 0) return null;
  return {
    price: close,
    changePercent24h: open && open > 0 ? ((close - open) / open) * 100 : null,
    high24h: num(data.h),
    low24h: num(data.l),
    volume24h: num(data.v),
    quoteVolume24h: num(data.q),
    fundingRate: null,
    nextFundingTime: null,
    timestamp: num(data.E) ?? Date.now(),
  };
}

function bybitTickerParse(rawSymbol: string, payload: unknown): LiveUpdate | null {
  if (!payload || typeof payload !== 'object') return null;
  const frame = payload as Record<string, unknown>;
  if (frame.topic !== `tickers.${rawSymbol}`) return null;
  const data = frame.data as Record<string, unknown> | undefined;
  if (!data) return null;
  const price = num(data.lastPrice);
  if (price === null || price <= 0) return null;
  const ratio = num(data.price24hPcnt);
  const nextFunding = num(data.nextFundingTime);
  return {
    price,
    changePercent24h: ratio === null ? null : ratio * 100,
    high24h: num(data.highPrice24h),
    low24h: num(data.lowPrice24h),
    volume24h: num(data.volume24h),
    quoteVolume24h: num(data.turnover24h),
    fundingRate: num(data.fundingRate),
    nextFundingTime: nextFunding && nextFunding > 0 ? nextFunding : null,
    timestamp: num(frame.ts) ?? Date.now(),
  };
}

const STREAMS: Record<ExchangeId, StreamConfig> = {
  'binance-spot': {
    url: (raw) => `wss://stream.binance.com:9443/ws/${raw.toLowerCase()}@miniTicker`,
    subscribe: null,
    ping: null,
    parse: binanceMiniTickerParse,
  },
  'binance-futures': {
    url: (raw) => `wss://fstream.binance.com/ws/${raw.toLowerCase()}@miniTicker`,
    subscribe: null,
    ping: null,
    parse: binanceMiniTickerParse,
  },
  'bybit-spot': {
    url: () => 'wss://stream.bybit.com/v5/public/spot',
    subscribe: (raw) => JSON.stringify({ op: 'subscribe', args: [`tickers.${raw}`] }),
    ping: { intervalMs: 20_000, payload: JSON.stringify({ op: 'ping' }) },
    parse: bybitTickerParse,
  },
  'bybit-linear': {
    url: () => 'wss://stream.bybit.com/v5/public/linear',
    subscribe: (raw) => JSON.stringify({ op: 'subscribe', args: [`tickers.${raw}`] }),
    ping: { intervalMs: 20_000, payload: JSON.stringify({ op: 'ping' }) },
    parse: bybitTickerParse,
  },
};

type UpdateListener = (update: LiveUpdate) => void;
type StatusListener = (status: StreamStatus) => void;

/**
 * One websocket per (exchange, symbol), shared by every component that needs it
 * and closed as soon as the last subscriber leaves. Reconnects with capped
 * exponential backoff; the caller keeps polling HTTP in the meantime.
 */
export class LiveTickerConnection {
  private socket: WebSocket | null = null;
  private updateListeners = new Set<UpdateListener>();
  private statusListeners = new Set<StatusListener>();
  private retries = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private closedByUser = false;
  private status: StreamStatus = 'connecting';
  readonly config: StreamConfig;
  readonly key: string;

  constructor(
    readonly exchange: ExchangeId,
    readonly rawSymbol: string,
  ) {
    this.key = `${exchange}:${rawSymbol}`;
    this.config = STREAMS[exchange];
  }

  getStatus(): StreamStatus {
    return this.status;
  }

  private setStatus(status: StreamStatus) {
    this.status = status;
    for (const listener of this.statusListeners) listener(status);
  }

  subscribe(onUpdate: UpdateListener, onStatus?: StatusListener): () => void {
    this.updateListeners.add(onUpdate);
    if (onStatus) {
      this.statusListeners.add(onStatus);
      onStatus(this.status);
    }
    if (!this.socket && !this.closedByUser) this.connect();
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      this.updateListeners.delete(onUpdate);
      if (onStatus) this.statusListeners.delete(onStatus);
      if (this.updateListeners.size === 0) this.close();
    };
  }

  private connect() {
    if (typeof WebSocket === 'undefined') {
      this.setStatus('unsupported');
      return;
    }
    this.setStatus(this.retries === 0 ? 'connecting' : 'reconnecting');
    let socket: WebSocket;
    try {
      socket = new WebSocket(this.config.url(this.rawSymbol));
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;

    socket.onopen = () => {
      this.retries = 0;
      this.setStatus('open');
      const subscribe = this.config.subscribe?.(this.rawSymbol);
      if (subscribe) socket.send(subscribe);
      if (this.config.ping) {
        this.pingTimer = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) socket.send(this.config.ping!.payload);
        }, this.config.ping.intervalMs);
      }
    };

    socket.onmessage = (event) => {
      let payload: unknown;
      try {
        payload = JSON.parse(String(event.data));
      } catch {
        return;
      }
      const update = this.config.parse(this.rawSymbol, payload);
      if (!update) return;
      for (const listener of this.updateListeners) listener(update);
    };

    socket.onerror = () => {
      // `onclose` always follows; reconnect logic lives there.
    };

    socket.onclose = () => {
      this.clearTimers();
      this.socket = null;
      if (this.closedByUser || this.updateListeners.size === 0) {
        this.setStatus('closed');
        return;
      }
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.setStatus('reconnecting');
    const delay = Math.min(20_000, 1_000 * 2 ** Math.min(this.retries, 5));
    this.retries += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.closedByUser && this.updateListeners.size > 0) this.connect();
    }, delay);
  }

  private clearTimers() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  close() {
    this.closedByUser = true;
    this.clearTimers();
    this.updateListeners.clear();
    this.statusListeners.clear();
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      try {
        socket.close();
      } catch {
        /* already closing */
      }
    }
    registry.delete(this.key);
    this.setStatus('closed');
  }
}

const registry = new Map<string, LiveTickerConnection>();

/** Reference-counted websocket accessor. */
export function acquireLiveTicker(exchange: ExchangeId, rawSymbol: string): LiveTickerConnection {
  const key = `${exchange}:${rawSymbol}`;
  const existing = registry.get(key);
  if (existing) return existing;
  const connection = new LiveTickerConnection(exchange, rawSymbol);
  registry.set(key, connection);
  return connection;
}

export function activeStreamCount(): number {
  return registry.size;
}

export function closeAllStreams(): void {
  for (const connection of [...registry.values()]) connection.close();
  registry.clear();
}
