import { useMemo } from 'react';
import { useLang, useT } from '../hooks/useI18n';
import { useIsMobile } from '../hooks/useMediaQuery';
import { flattenTickers, useMarkets, tickerIndex } from '../store/markets';
import { useWatchlist } from '../store/watchlist';
import { MarketTable } from '../components/MarketTable';
import { ChartPanel } from '../components/ChartPanel';
import { OrderBookPanel } from '../components/OrderBookPanel';
import { FundingPanel } from '../components/FundingPanel';
import { SourceStatus } from '../components/SourceStatus';
import { Delta, EmptyState, StarButton } from '../components/ui';
import { Segmented } from '../components/ui';
import { formatDateTime, formatPrice, formatRatioAsPercent } from '../lib/format';
import { openPair } from '../lib/router';
import { sourceLabel } from '../data';
import type { ExchangeId, MarketTicker } from '../lib/types';
import { useState } from 'react';
import { navigate } from '../lib/router';

function venueChips(tickers: MarketTicker[], base: string, quote: string): MarketTicker[] {
  const order: ExchangeId[] = ['binance-spot', 'bybit-spot', 'binance-futures', 'bybit-linear'];
  return tickers
    .filter((ticker) => ticker.base === base && ticker.quote === quote)
    .sort((a, b) => order.indexOf(a.exchange) - order.indexOf(b.exchange));
}

function PairInfo({ ticker }: { ticker: MarketTicker }) {
  const t = useT();
  const lang = useLang();
  const rows: Array<[string, string]> = [
    [t('common.exchange'), sourceLabel(ticker.exchange, lang)],
    [t('pair.kind'), ticker.kind === 'spot' ? t('common.spot') : t('common.futures')],
    [t('pair.base'), ticker.base],
    [t('pair.quote'), ticker.quote],
    [t('pair.rawSymbol'), ticker.rawSymbol],
    [t('common.bid'), formatPrice(ticker.bid, lang)],
    [t('common.ask'), formatPrice(ticker.ask, lang)],
    [t('common.high24h'), formatPrice(ticker.high24h, lang)],
    [t('common.low24h'), formatPrice(ticker.low24h, lang)],
    [t('common.funding'), formatRatioAsPercent(ticker.fundingRate, 4)],
    [t('pair.markPrice'), formatPrice(ticker.markPrice, lang)],
    [t('pair.exchangeTime'), formatDateTime(ticker.timestamp, lang)],
    [t('pair.localTime'), formatDateTime(ticker.fetchedAt, lang)],
  ];
  return (
    <section className="panel" aria-label={t('pair.info')}>
      <div className="panel-head">
        <h2 className="panel-title">{t('pair.info')}</h2>
      </div>
      <dl className="divide-y divide-line/60">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-2 px-2 py-[3px]">
            <dt className="text-[10px] text-muted">{label}</dt>
            <dd className="num truncate text-[10px] text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="border-t border-line px-2 py-1.5 text-[10px] leading-relaxed text-muted">{t('pair.readOnly')}</p>
    </section>
  );
}

export function PairView({ exchange, rawSymbol }: { exchange: ExchangeId; rawSymbol: string }) {
  const t = useT();
  const lang = useLang();
  const isMobile = useIsMobile();
  const sources = useMarkets((state) => state.sources);
  const tickers = useMemo(() => flattenTickers(sources), [sources]);
  const index = useMemo(() => tickerIndex(sources), [sources]);
  const [mobileTab, setMobileTab] = useState<'chart' | 'book' | 'funding' | 'info'>('chart');

  const toggleFavorite = useWatchlist((state) => state.toggle);
  const watchGroups = useWatchlist((state) => state.groups);
  const activeGroupId = useWatchlist((state) => state.activeGroupId);

  const ticker = index.get(`${exchange}:${rawSymbol}`) ?? null;
  const source = sources[exchange];
  const loaded = source?.status === 'ready';

  if (!ticker && loaded) {
    return (
      <div className="panel">
        <EmptyState message={t('pair.notFound')} hint={`${sourceLabel(exchange, lang)} · ${rawSymbol}`} />
        <div className="flex justify-center pb-6">
          <button type="button" className="btn" onClick={() => navigate({ view: 'markets', exchange: null, rawSymbol: null, comparePair: null })}>
            {t('common.back')}
          </button>
        </div>
      </div>
    );
  }

  const base = ticker?.base ?? rawSymbol.replace(/(USDT|USDC|USD|BTC|ETH)$/i, '');
  const quote = ticker?.quote ?? 'USDT';
  const venues = ticker ? venueChips(tickers, ticker.base, ticker.quote) : [];
  const watchedList = watchGroups.find((group) => group.id === activeGroupId)?.items ?? [];
  const watched = ticker ? watchedList.includes(ticker.id) : false;

  const sameBaseRows = tickers.filter((entry) => entry.base === base);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <button
          type="button"
          onClick={() => window.history.length > 1 ? window.history.back() : navigate({ view: 'markets', exchange: null, rawSymbol: null, comparePair: null })}
          className="btn btn-ghost h-6 px-1.5 text-2xs"
        >
          ← {t('common.back')}
        </button>
        <h1 className="font-mono text-sm font-semibold text-ink">
          {ticker?.symbol ?? `${base}/${quote}`}
        </h1>
        <span className="rounded bg-raised px-1 text-[9px] font-semibold uppercase tracking-wide text-muted">
          {sourceLabel(exchange, lang)}
        </span>
        {ticker && (
          <>
            <span className="num text-sm font-semibold text-ink">{formatPrice(ticker.price, lang)}</span>
            <Delta value={ticker.changePercent24h} />
            <StarButton active={watched} onToggle={() => toggleFavorite(`${exchange}:${rawSymbol}`)} size="md" />
          </>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-1">
          {venues.map((venue) => {
            const active = venue.exchange === exchange;
            return (
              <button
                key={venue.exchange}
                type="button"
                onClick={() => openPair(venue.exchange, venue.rawSymbol)}
                className={`rounded border px-1.5 py-0.5 text-2xs font-medium transition-colors ${
                  active ? 'border-accent/60 bg-accent/15 text-accent' : 'border-line text-muted hover:text-ink'
                }`}
              >
                {sourceLabel(venue.exchange, lang)}
                <span className="num ml-1 text-[10px]">{formatPrice(venue.price, lang)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <SourceStatus compact />

      {isMobile && (
        <Segmented
          options={[
            { value: 'chart', label: t('mobile.tab.chart') },
            { value: 'book', label: t('mobile.tab.book') },
            { value: 'funding', label: t('common.funding') },
            { value: 'info', label: t('pair.info') },
          ]}
          value={mobileTab}
          onChange={setMobileTab}
          ariaLabel={t('nav.menu')}
          className="self-start"
        />
      )}

      <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-2">
          {(!isMobile || mobileTab === 'chart') && (
            <ChartPanel
              exchange={exchange}
              rawSymbol={rawSymbol}
              symbol={ticker?.symbol ?? `${base}/${quote}`}
              heightClass={isMobile ? 'h-[330px]' : 'h-[440px]'}
            />
          )}

          {!isMobile && (
            <MarketTable
              tickers={sameBaseRows}
              showKindFilter={false}
              showFunding
              initialQuery={base}
              heightClass="h-[240px]"
            />
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-2">
          {(!isMobile || mobileTab === 'book') && (
            <OrderBookPanel
              exchange={exchange}
              rawSymbol={rawSymbol}
              symbol={ticker?.symbol ?? `${base}/${quote}`}
              rows={isMobile ? 10 : 12}
            />
          )}
          {(!isMobile || mobileTab === 'funding') && (
            <FundingPanel exchange={exchange} rawSymbol={rawSymbol} symbol={ticker?.symbol ?? `${base}/${quote}`} compact={isMobile} />
          )}
          {!isMobile && ticker && <PairInfo ticker={ticker} />}
          {isMobile && mobileTab === 'info' && ticker && <PairInfo ticker={ticker} />}
        </aside>
      </div>
    </div>
  );
}
