/**
 * Minimal fetch wrapper: timeouts, in-flight de-duplication, one retry on
 * transient failures and typed errors so the UI can show what actually broke.
 */

export type HttpErrorKind = 'timeout' | 'network' | 'http' | 'parse' | 'aborted';

export class HttpError extends Error {
  readonly kind: HttpErrorKind;
  readonly status: number | null;
  readonly url: string;

  constructor(kind: HttpErrorKind, message: string, url: string, status: number | null = null) {
    super(message);
    this.name = 'HttpError';
    this.kind = kind;
    this.status = status;
    this.url = url;
  }
}

export interface RequestOptions {
  timeoutMs?: number;
  retries?: number;
  signal?: AbortSignal;
  /** Optional cache-busting salt, ignored by exchanges but useful for tests. */
  headers?: Record<string, string>;
}

const DEFAULT_TIMEOUT = 12_000;
/** Identical URLs requested within this window share a single network call. */
const DEDUPE_WINDOW = 400;

const inflight = new Map<string, Promise<unknown>>();
const recent = new Map<string, { at: number; value: unknown }>();

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function once<T>(url: string, options: RequestOptions): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT, signal, headers } = options;
  const controller = new AbortController();
  const onOuterAbort = () => controller.abort();
  signal?.addEventListener('abort', onOuterAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        ...headers,
      },
      // Market data must never be served from the browser HTTP cache.
      cache: 'no-store',
      mode: 'cors',
      credentials: 'omit',
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new HttpError('http', `HTTP ${response.status} ${body.slice(0, 180)}`.trim(), url, response.status);
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new HttpError('parse', 'Malformed JSON payload', url, response.status);
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      if (signal?.aborted) throw new HttpError('aborted', 'Request aborted', url);
      throw new HttpError('timeout', `Request timed out after ${timeoutMs}ms`, url);
    }
    throw new HttpError('network', error instanceof Error ? error.message : 'Network error', url);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onOuterAbort);
  }
}

function isRetryable(error: unknown): boolean {
  if (!(error instanceof HttpError)) return false;
  if (error.kind === 'network') return true;
  if (error.kind === 'http') return error.status !== null && (error.status >= 500 || error.status === 429);
  return false;
}

/**
 * GET a JSON document with de-duplication and a single retry for transient
 * failures (429 / 5xx / network). Order-book and ticker polling rely on this so
 * several panels asking for the same URL in the same tick cost one request.
 */
export async function getJson<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const { retries = 1, ...rest } = options;
  const now = Date.now();
  const cached = recent.get(url);
  if (cached && now - cached.at < DEDUPE_WINDOW) {
    return cached.value as T;
  }

  const existing = inflight.get(url);
  if (existing) return existing as Promise<T>;

  const task = (async () => {
    let attempt = 0;
    for (;;) {
      try {
        const value = await once<T>(url, rest);
        recent.set(url, { at: Date.now(), value });
        if (recent.size > 200) {
          const cutoff = Date.now() - 60_000;
          for (const [key, entry] of recent) if (entry.at < cutoff) recent.delete(key);
        }
        return value;
      } catch (error) {
        if (attempt >= retries || !isRetryable(error)) throw error;
        attempt += 1;
        await sleep(400 * attempt, rest.signal);
      }
    }
  })();

  inflight.set(url, task);
  try {
    return await task;
  } finally {
    inflight.delete(url);
  }
}

/** Small numeric helper used by adapters that receive string numbers. */
export function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Clears the de-duplication cache. Used by tests and manual "refresh now". */
export function clearHttpCache(): void {
  recent.clear();
  inflight.clear();
}

export function describeHttpError(error: unknown): string {
  if (error instanceof HttpError) {
    switch (error.kind) {
      case 'timeout':
        return 'timeout';
      case 'network':
        return 'network';
      case 'parse':
        return 'bad-payload';
      case 'aborted':
        return 'aborted';
      default:
        return error.status ? `http-${error.status}` : 'http';
    }
  }
  return 'unknown';
}
