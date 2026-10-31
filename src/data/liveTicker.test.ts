import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveTickerConnection, acquireLiveTicker, activeStreamCount, closeAllStreams } from './liveTicker';

/** Minimal WebSocket double that lets tests drive open/message/close. */
class FakeSocket {
  static instances: FakeSocket[] = [];
  static OPEN = 1;
  static CLOSED = 3;

  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  closed = false;

  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }

  send(payload: string) {
    this.sent.push(payload);
  }

  close() {
    this.closed = true;
    this.readyState = FakeSocket.CLOSED;
  }

  // test helpers
  open() {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.();
  }

  emit(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }

  drop() {
    this.readyState = FakeSocket.CLOSED;
    this.onclose?.();
  }
}

function installFakeWebSocket() {
  FakeSocket.instances = [];
  vi.stubGlobal('WebSocket', Object.assign(FakeSocket, { OPEN: 1, CLOSED: 3 }) as unknown as typeof WebSocket);
}

afterEach(() => {
  closeAllStreams();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('live ticker streams', () => {
  it('shares one socket between subscribers and closes it after the last one leaves', () => {
    installFakeWebSocket();
    const first = acquireLiveTicker('binance-spot', 'BTCUSDT');
    const second = acquireLiveTicker('binance-spot', 'BTCUSDT');
    expect(first).toBe(second);

    const unsubscribeA = first.subscribe(() => {});
    const unsubscribeB = second.subscribe(() => {});
    expect(FakeSocket.instances).toHaveLength(1);
    expect(FakeSocket.instances[0].url).toContain('btcusdt@miniTicker');

    unsubscribeA();
    expect(FakeSocket.instances[0].closed).toBe(false);
    unsubscribeB();
    expect(FakeSocket.instances[0].closed).toBe(true);
    expect(activeStreamCount()).toBe(0);
  });

  it('parses Binance mini-ticker frames into a price + change', () => {
    installFakeWebSocket();
    const received: Array<{ price: number; changePercent24h: number | null }> = [];
    const connection = acquireLiveTicker('binance-futures', 'ETHUSDT');
    connection.subscribe((update) => received.push(update));
    const socket = FakeSocket.instances[0];
    socket.open();
    socket.emit({ e: '24hrMiniTicker', s: 'ETHUSDT', c: '3300', o: '3000', h: '3400', l: '2900', v: '100', q: '330000', E: 1_700_000_000_000 });

    expect(received).toHaveLength(1);
    expect(received[0].price).toBe(3300);
    expect(received[0].changePercent24h).toBeCloseTo(10, 5);
  });

  it('subscribes and diffs Bybit ticker frames', () => {
    installFakeWebSocket();
    const updates: number[] = [];
    const connection = acquireLiveTicker('bybit-linear', 'BTCUSDT');
    connection.subscribe((update) => updates.push(update.price));
    const socket = FakeSocket.instances[0];
    socket.open();
    expect(socket.sent[0]).toContain('"op":"subscribe"');
    expect(socket.sent[0]).toContain('tickers.BTCUSDT');

    socket.emit({
      topic: 'tickers.BTCUSDT',
      ts: 1_700_000_000_000,
      data: { lastPrice: '65010.5', price24hPcnt: '0.02', volume24h: '1000', turnover24h: '65000000' },
    });
    expect(updates).toEqual([65010.5]);
  });

  it('ignores frames for other symbols and malformed payloads', () => {
    installFakeWebSocket();
    const updates: number[] = [];
    const connection = acquireLiveTicker('bybit-spot', 'BTCUSDT');
    connection.subscribe((update) => updates.push(update.price));
    const socket = FakeSocket.instances[0];
    socket.open();
    socket.emit({ topic: 'tickers.ETHUSDT', data: { lastPrice: '3000' } });
    socket.emit({ nope: true });
    socket.onmessage?.({ data: 'not-json' });
    expect(updates).toEqual([]);
  });

  it('reports reconnecting and retries after an unexpected close', () => {
    vi.useFakeTimers();
    installFakeWebSocket();
    const statuses: string[] = [];
    const connection = acquireLiveTicker('binance-spot', 'SOLUSDT');
    connection.subscribe(
      () => {},
      (status) => statuses.push(status),
    );
    const socket = FakeSocket.instances[0];
    socket.open();
    socket.drop();

    expect(statuses).toContain('reconnecting');
    vi.advanceTimersByTime(1_100);
    expect(FakeSocket.instances.length).toBe(2);
  });

  it('does not reconnect once every subscriber has left', () => {
    vi.useFakeTimers();
    installFakeWebSocket();
    const connection = new LiveTickerConnection('bybit-spot', 'ETHUSDT');
    const unsubscribe = connection.subscribe(() => {});
    const socket = FakeSocket.instances[0];
    socket.open();
    unsubscribe();
    vi.advanceTimersByTime(30_000);
    expect(FakeSocket.instances).toHaveLength(1);
  });
});
