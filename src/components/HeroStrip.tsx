import { useMemo } from 'react';
import { useLang, useT } from '../hooks/useI18n';
import { useNow } from '../hooks/useNow';
import { useMarkets, flattenTickers } from '../store/markets';
import { findReferenceTicker, marketBreadth, topMovers } from '../lib/selectors';
import { formatAge, formatCompact, formatPrice } from '../lib/format';
import { openPair } from '../lib/router';
import { sourceLabel } from '../data';
import { useWatchlist } from '../store/watchlist';
import type { MarketTicker } from '../lib/types';
import { Delta, PriceFlash, Skeleton, StarButton } from './ui';

function HeroCard({ asset, ticker }: { asset: string; ticker: MarketTicker | null }) {
  const t = useT();
  const lang = useLang();
  const now = useNow(2000);
  const favoriteIds = useWatchlist((state) =>
    state.groups.find((group) => group.id === state.activeGroupId)?.items ?? [],
  );
  const toggleFavorite = useWatchlist((state) => state.toggle);

  if (!ticker) {
    return (
      <div className="panel flex-1 p-3">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-sm font-semibold text-ink">{asset}</span>
          <Skeleton className="h-3 w-14" />
        </div>
        <Skeleton className="mt-2 h-6 w-32" />
        <Skeleton className="mt-1.5 h-3 w-20" />
      </div>
    );
  }

  return (
    <div className="panel group relative flex-1 p-2.5 transition-colors hover:border-accent/40">
      {/* Full-card activation target. Kept as a sibling of the star so the two
          interactive elements are never nested. */}
      <button
        type="button"
        onClick={() => openPair(ticker.exchange, ticker.rawSymbol)}
        className="absolute inset-0 z-0 rounded-card"
        aria-label={`${t('search.open')} ${ticker.symbol} ${sourceLabel(ticker.exchange, lang)}`}
      />
      <div className="relative z-10 flex items-start justify-between gap-1">
        <div className="pointer-events-none flex items-baseline gap-1.5">
          <span className="font-mono text-sm font-semibold text-ink">{ticker.base}</span>
          <span className="text-[10px] uppercase tracking-wide text-muted">{ticker.quote}</span>
          <span className="rounded bg-raised px-1 text-[9px] font-semibold uppercase tracking-wide text-muted">
            {sourceLabel(ticker.exchange, lang)}
          </span>
        </div>
        <StarButton active={favoriteIds.includes(ticker.id)} onToggle={() => toggleFavorite(ticker.id)} />
      </div>
      <div className="pointer-events-none relative z-10 mt-1 flex items-baseline gap-2">
        <span className="num text-xl font-semibold tracking-tight text-ink">
          <PriceFlash value={formatPrice(ticker.price, lang)} />
        </span>
        <Delta value={ticker.changePercent24h} className="text-xs" />
      </div>
      <div className="pointer-events-none relative z-10 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted">
        <span className="num">
          H {formatPrice(ticker.high24h, lang)} · L {formatPrice(ticker.low24h, lang)}
        </span>
        <span className="num">
          {t('common.quoteVolume24h')} {formatCompact(ticker.quoteVolume24h, lang)}
        </span>
        <span className="ml-auto">{formatAge(ticker.fetchedAt, now, lang)}</span>
      </div>
      <span className="pointer-events-none absolute inset-x-2 bottom-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
    </div>
  );
}

function MoverList({ title, tickers }: { title: string; tickers: MarketTicker[] }) {
  const lang = useLang();
  if (tickers.length === 0) return null;
  return (
    <div className="min-w-0">
      <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted">{title}</p>
      <ul className="space-y-[2px]">
        {tickers.slice(0, 4).map((ticker) => (
          <li key={ticker.id}>
            <button
              type="button"
              onClick={() => openPair(ticker.exchange, ticker.rawSymbol)}
              className="flex w-full items-center gap-1.5 rounded px-0.5 text-[10px] hover:bg-raised"
            >
              <span className="w-12 shrink-0 truncate font-mono text-ink">{ticker.base}</span>
              <span className="num ml-auto text-muted">{formatPrice(ticker.price, lang)}</span>
              <Delta value={ticker.changePercent24h} digits={2} showArrow={false} className="w-14 text-right" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HeroStrip() {
  const t = useT();
  const lang = useLang();
  const sources = useMarkets((state) => state.sources);
  const tickers = useMemo(() => flattenTickers(sources), [sources]);

  const btc = useMemo(() => findReferenceTicker(tickers, 'BTC'), [tickers]);
  const eth = useMemo(() => findReferenceTicker(tickers, 'ETH'), [tickers]);
  const breadth = useMemo(() => marketBreadth(tickers), [tickers]);
  const movers = useMemo(() => topMovers(tickers, 4), [tickers]);
  const total = Math.max(1, breadth.advancing + breadth.declining);
  const advShare = (breadth.advancing / total) * 100;

  return (
    <section className="flex flex-col gap-2" aria-label={t('hero.breadth')}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <HeroCard asset="BTC" ticker={btc} />
        <HeroCard asset="ETH" ticker={eth} />

        <div className="panel flex min-w-0 flex-1 flex-col justify-between gap-1 p-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">{t('hero.breadth')}</span>
            <span className="num text-[10px] text-muted">
              {t('common.quoteVolume24h')} {formatCompact(breadth.turnover, lang)}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="num text-sm font-semibold text-up">
              {breadth.advancing} <span className="text-[10px] font-normal text-muted">{t('hero.advancing')}</span>
            </span>
            <span className="num text-sm font-semibold text-down">
              {breadth.declining} <span className="text-[10px] font-normal text-muted">{t('hero.declining')}</span>
            </span>
            <span className="num ml-auto text-[10px] text-muted">{t('hero.breadthSub')}</span>
          </div>
          <div className="flex h-1.5 overflow-hidden rounded bg-raised" role="img" aria-label={`${breadth.advancing}/${breadth.declining}`}>
            <span className="bg-up" style={{ width: `${advShare}%` }} />
            <span className="bg-down" style={{ width: `${100 - advShare}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MoverList title={t('hero.topGainers')} tickers={movers.gainers} />
            <MoverList title={t('hero.topLosers')} tickers={movers.losers} />
          </div>
        </div>
      </div>
    </section>
  );
}
