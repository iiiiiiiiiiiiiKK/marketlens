import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../hooks/useI18n';
import { useSettings } from '../store/settings';
import { flattenTickers, useMarkets } from '../store/markets';
import { sourceLabel } from '../data';
import { openPair } from '../lib/router';
import { POPULAR_PAIRS } from '../lib/constants';
import { findReferenceTicker, matchesQuery } from '../lib/selectors';
import { useWatchlist } from '../store/watchlist';
import { useIsMobile } from '../hooks/useMediaQuery';
import type { MarketTicker } from '../lib/types';
import { formatPrice } from '../lib/format';
import { EmptyState, Pill } from './ui';
import { Modal } from './ui';

interface SearchPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function SearchPalette({ open, onClose }: SearchPaletteProps) {
  const t = useT();
  const lang = useSettings((state) => state.lang);
  const sources = useMarkets((state) => state.sources);
  const recent = useWatchlist((state) => state.recent);
  const pushRecent = useWatchlist((state) => state.pushRecent);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  const tickers = useMemo(() => flattenTickers(sources), [sources]);

  const byId = useMemo(() => {
    const map = new Map<string, MarketTicker>();
    for (const ticker of tickers) map.set(ticker.id, ticker);
    return map;
  }, [tickers]);

  const results = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      const popular: MarketTicker[] = [];
      for (const asset of POPULAR_PAIRS) {
        const reference = findReferenceTicker(tickers, asset);
        if (reference) popular.push(reference);
      }
      return popular.slice(0, 8);
    }
    const matches = tickers.filter((ticker) => matchesQuery(ticker, trimmed));
    // Prefer USDT majors, then liquidity.
    matches.sort((a, b) => {
      const score = (ticker: MarketTicker) =>
        (ticker.quote === 'USDT' ? 1e12 : 0) + (ticker.quoteVolume24h ?? 0) - (ticker.kind === 'futures' ? 1 : 0);
      return score(b) - score(a);
    });
    return matches.slice(0, 40);
  }, [query, tickers]);

  const recentTickers = useMemo(
    () => recent.map((id) => byId.get(id)).filter((ticker): ticker is MarketTicker => Boolean(ticker)),
    [recent, byId],
  );

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      const timer = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const choose = (ticker: MarketTicker) => {
    pushRecent(ticker.id);
    openPair(ticker.exchange, ticker.rawSymbol);
    onClose();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(results.length - 1, index + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const target = results[activeIndex];
      if (target) choose(target);
    }
  };

  return (
    <Modal open={open} onClose={onClose} labelledBy="search-title" className={isMobile ? 'mt-0' : ''}>
      <div onKeyDown={onKeyDown}>
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          <span aria-hidden="true" className="text-muted">
            ⌕
          </span>
          <h2 id="search-title" className="sr-only">
            {t('common.search')}
          </h2>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('search.placeholder')}
            className="w-full bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
            aria-label={t('search.placeholder')}
            autoComplete="off"
            spellCheck={false}
          />
          <button type="button" onClick={onClose} className="btn btn-ghost h-6 px-1.5 text-2xs">
            Esc
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {query.trim() === '' && recentTickers.length > 0 && (
            <section aria-label={t('search.recent')} className="border-b border-line/60 px-2 py-2">
              <p className="px-1 pb-1 text-2xs font-semibold uppercase tracking-wider text-muted">
                {t('search.recent')}
              </p>
              <ul>
                {recentTickers.map((ticker) => (
                  <li key={`recent-${ticker.id}`}>
                    <button
                      type="button"
                      onClick={() => choose(ticker)}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-raised"
                    >
                      <span className="font-mono text-ink">{ticker.symbol}</span>
                      <Pill>{sourceLabel(ticker.exchange, lang)}</Pill>
                      <span className="ml-auto num text-muted">{formatPrice(ticker.price, lang)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {results.length === 0 ? (
            <EmptyState message={t('search.empty', { q: query.trim() })} />
          ) : (
            <ul className="p-1.5" role="listbox" aria-label={t('common.search')}>
              {query.trim() === '' && (
                <li className="px-1.5 pb-1 pt-1 text-2xs font-semibold uppercase tracking-wider text-muted">
                  {t('search.suggested')}
                </li>
              )}
              {results.map((ticker, index) => {
                const active = index === activeIndex;
                return (
                  <li key={ticker.id} role="option" aria-selected={active}>
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => choose(ticker)}
                      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors ${
                        active ? 'bg-raised' : 'hover:bg-raised/60'
                      }`}
                    >
                      <span className="w-24 shrink-0 font-mono text-xs text-ink">{ticker.symbol}</span>
                      <Pill tone={ticker.kind === 'futures' ? 'accent' : 'neutral'}>
                        {ticker.kind === 'futures' ? t('common.futures') : t('common.spot')}
                      </Pill>
                      <span className="truncate text-2xs text-muted">{sourceLabel(ticker.exchange, lang)}</span>
                      <span className="ml-auto num shrink-0 text-xs text-ink">{formatPrice(ticker.price, lang)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <p className="border-t border-line px-3 py-1.5 text-[10px] text-muted">{t('search.hint')}</p>
      </div>
    </Modal>
  );
}
