import { useEffect, useState } from 'react';
import type { ExchangeId } from './types';

export type View = 'markets' | 'spot' | 'futures' | 'compare' | 'watchlist' | 'settings' | 'pair';

export interface Route {
  view: View;
  exchange: ExchangeId | null;
  rawSymbol: string | null;
  comparePair: string | null;
}

const VIEWS: View[] = ['markets', 'spot', 'futures', 'compare', 'watchlist', 'settings', 'pair'];

export const DEFAULT_ROUTE: Route = {
  view: 'markets',
  exchange: null,
  rawSymbol: null,
  comparePair: null,
};

const EXCHANGES: ExchangeId[] = ['binance-spot', 'binance-futures', 'bybit-spot', 'bybit-linear'];

/**
 * Tiny hash router. Hash routing keeps deep links working on static hosts
 * (GitHub Pages) with no server-side rewrite rules.
 */
export function parseHash(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '');
  if (!clean) return { ...DEFAULT_ROUTE };
  const [path, search] = clean.split('?');
  const segments = path.split('/').filter(Boolean).map(decodeURIComponent);
  const params = new URLSearchParams(search ?? '');
  const comparePair = params.get('pair');

  const [head, second, third] = segments;
  if (head === 'pair' && second && third) {
    const exchange = EXCHANGES.find((id) => id === second);
    if (exchange) {
      return { view: 'pair', exchange, rawSymbol: third.toUpperCase(), comparePair: null };
    }
  }
  const view = VIEWS.find((candidate) => candidate === head) ?? 'markets';
  if (view === 'pair') return { ...DEFAULT_ROUTE };
  return { view, exchange: null, rawSymbol: null, comparePair };
}

export function toHash(route: Route): string {
  if (route.view === 'pair' && route.exchange && route.rawSymbol) {
    return `#/pair/${route.exchange}/${encodeURIComponent(route.rawSymbol)}`;
  }
  if (route.view === 'compare' && route.comparePair) {
    return `#/compare?pair=${encodeURIComponent(route.comparePair)}`;
  }
  return `#/${route.view}`;
}

export function navigate(route: Route): void {
  const hash = toHash(route);
  if (window.location.hash !== hash) window.location.hash = hash;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(typeof window === 'undefined' ? '' : window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}

/** Opens a specific market on a venue. */
export function openPair(exchange: ExchangeId, rawSymbol: string): void {
  navigate({ view: 'pair', exchange, rawSymbol, comparePair: null });
}
