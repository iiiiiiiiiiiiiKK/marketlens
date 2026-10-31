import { useCallback, useMemo, useRef, useState } from 'react';
import { useT } from '../hooks/useI18n';
import { useLang } from '../hooks/useI18n';
import { useIsMobile, useMediaQuery } from '../hooks/useMediaQuery';
import { formatCompact, formatPrice, formatRatioAsPercent } from '../lib/format';
import { buildCsv, csvFilename, downloadCsv } from '../lib/csv';
import { sourceLabel } from '../data';
import { openPair } from '../lib/router';
import type { ExchangeId, MarketKind, MarketTicker } from '../lib/types';
import type { MarketFilters, SortDirection, SortKey } from '../lib/selectors';
import { filterTickers, quoteOptions, sortTickers } from '../lib/selectors';
import { useWatchlist } from '../store/watchlist';
import { useSettings } from '../store/settings';
import { Delta, EmptyState, ErrorState, PriceFlash, Spinner, StarButton, TableSkeleton } from './ui';

interface ColumnDef {
  id: 'star' | 'pair' | 'price' | 'change' | 'high' | 'low' | 'volume' | 'turnover' | 'funding' | 'source';
  label: string;
  width: string;
  sortKey: SortKey | null;
  align: 'left' | 'right';
}

export interface MarketTableProps {
  tickers: MarketTicker[];
  loading?: boolean;
  error?: string | null;
  errorExchange?: ExchangeId;
  onRetry?: () => void;
  showKindFilter?: boolean;
  showFunding?: boolean;
  fixedKind?: MarketKind | null;
  heightClass?: string;
  emptyMessage?: string;
  initialQuery?: string;
}

const ROW_HEIGHT = 34;
const OVERSCAN = 8;

export function MarketTable({
  tickers,
  loading = false,
  error = null,
  errorExchange,
  onRetry,
  showKindFilter = true,
  showFunding = false,
  fixedKind = null,
  heightClass = 'h-[420px] sm:h-[520px]',
  emptyMessage,
  initialQuery = '',
}: MarketTableProps) {
  const t = useT();
  const lang = useLang();
  const isMobile = useIsMobile();
  const isCompact = useMediaQuery('(max-width: 1023px)');
  const paused = useSettings((state) => state.paused);
  const setPaused = useSettings((state) => state.setPaused);

  const [query, setQuery] = useState(initialQuery);
  const [exchanges, setExchanges] = useState<ExchangeId[]>([]);
  const [kinds, setKinds] = useState<MarketKind[]>(fixedKind ? [fixedKind] : []);
  const [quotes, setQuotes] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(480);
  const scrollRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  const groups = useWatchlist((state) => state.groups);
  const activeGroupId = useWatchlist((state) => state.activeGroupId);
  const toggleFavorite = useWatchlist((state) => state.toggle);
  const favoriteIds = useMemo(
    () => groups.find((group) => group.id === activeGroupId)?.items ?? [],
    [groups, activeGroupId],
  );

  const filters: MarketFilters = useMemo(
    () => ({ query, exchanges, kinds, quotes }),
    [query, exchanges, kinds, quotes],
  );

  const rows = useMemo(() => sortTickers(filterTickers(tickers, filters), sortKey, sortDir), [tickers, filters, sortKey, sortDir]);
  const allQuotes = useMemo(() => quoteOptions(tickers).slice(0, 14), [tickers]);

  const columns = useMemo<ColumnDef[]>(() => {
    const base: ColumnDef[] = [
      { id: 'star', label: '', width: '26px', sortKey: null, align: 'left' },
      { id: 'pair', label: t('common.pair'), width: isMobile ? 'minmax(0,1fr)' : 'minmax(140px,1.6fr)', sortKey: 'symbol', align: 'left' },
      { id: 'price', label: t('common.price'), width: isMobile ? '92px' : '108px', sortKey: 'price', align: 'right' },
      { id: 'change', label: t('common.change24h'), width: isMobile ? '76px' : '90px', sortKey: 'changePercent24h', align: 'right' },
    ];
    const wide: ColumnDef[] = [
      { id: 'high', label: t('common.high24h'), width: '96px', sortKey: 'high24h', align: 'right' },
      { id: 'low', label: t('common.low24h'), width: '96px', sortKey: 'low24h', align: 'right' },
    ];
    const fuller: ColumnDef[] = [
      { id: 'volume', label: t('common.volume24h'), width: '104px', sortKey: 'volume24h', align: 'right' },
      { id: 'turnover', label: t('common.quoteVolume24h'), width: '112px', sortKey: 'quoteVolume24h', align: 'right' },
    ];
    if (showFunding) {
      fuller.push({ id: 'funding', label: t('common.funding'), width: '92px', sortKey: 'fundingRate', align: 'right' });
    }
    fuller.push({ id: 'source', label: t('common.source'), width: '116px', sortKey: 'source', align: 'left' });

    const cols = [...base];
    if (!isCompact) cols.push(...wide);
    if (!isCompact) cols.push(...fuller);
    return cols;
  }, [t, isMobile, isCompact, showFunding]);

  const template = useMemo(() => columns.map((column) => column.width).join(' '), [columns]);

  const onScroll = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    setScrollTop(node.scrollTop);
  }, []);

  const attachObserver = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    scrollRef.current = node;
    if (!node) return;
    setViewportHeight(node.clientHeight);
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => setViewportHeight(node.clientHeight));
      observer.observe(node);
      observerRef.current = observer;
    }
  }, []);

  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const visibleCount = Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN * 2;
  const end = Math.min(rows.length, start + visibleCount);
  const visibleRows = rows.slice(start, end);

  const toggleSort = (key: SortKey | null) => {
    if (!key) return;
    if (sortKey === key) {
      setSortDir((direction) => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'symbol' || key === 'source' ? 'asc' : 'desc');
    }
  };

  const toggleIn = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

  const exportCsv = () => {
    if (rows.length === 0) return;
    const content = buildCsv(rows, lang);
    downloadCsv(content, csvFilename(fixedKind ?? 'markets'));
  };

  const allExchangeChips: Array<{ id: ExchangeId; label: string }> = [
    { id: 'binance-spot', label: sourceLabel('binance-spot', lang) },
    { id: 'binance-futures', label: sourceLabel('binance-futures', lang) },
    { id: 'bybit-spot', label: sourceLabel('bybit-spot', lang) },
    { id: 'bybit-linear', label: sourceLabel('bybit-linear', lang) },
  ];
  const exchangeChips = allExchangeChips.filter((chip) =>
    fixedKind === 'spot' ? chip.id.endsWith('spot') : fixedKind === 'futures' ? !chip.id.endsWith('spot') : true,
  );

  return (
    <section className="panel flex min-h-0 flex-col" aria-label={t('markets.title')}>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-2 py-1.5">
        <div className="relative">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('markets.searchPlaceholder')}
            aria-label={t('markets.searchPlaceholder')}
            className="input h-7 w-[132px] pl-6 text-2xs sm:w-[180px]"
            spellCheck={false}
          />
          <span aria-hidden="true" className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-muted">
            ⌕
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {exchangeChips.map((chip) => {
            const active = exchanges.includes(chip.id);
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setExchanges((list) => toggleIn(list, chip.id))}
                aria-pressed={active}
                className={`rounded border px-1.5 py-0.5 text-2xs font-medium transition-colors ${
                  active ? 'border-accent/60 bg-accent/15 text-accent' : 'border-line text-muted hover:text-ink'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        {showKindFilter && !fixedKind && (
          <div className="flex items-center gap-1">
            {(['spot', 'futures'] as MarketKind[]).map((kind) => {
              const active = kinds.includes(kind);
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setKinds((list) => toggleIn(list, kind))}
                  aria-pressed={active}
                  className={`rounded border px-1.5 py-0.5 text-2xs font-medium transition-colors ${
                    active ? 'border-accent/60 bg-accent/15 text-accent' : 'border-line text-muted hover:text-ink'
                  }`}
                >
                  {kind === 'spot' ? t('common.spot') : t('common.futures')}
                </button>
              );
            })}
          </div>
        )}

        <label className="flex items-center gap-1 text-2xs text-muted">
          <span className="hidden sm:inline">{t('markets.filterQuote')}</span>
          <select
            value={quotes[0] ?? ''}
            onChange={(event) => setQuotes(event.target.value ? [event.target.value] : [])}
            aria-label={t('markets.filterQuote')}
            className="h-7 rounded border border-line bg-panel px-1 text-2xs text-ink focus:border-accent/70 focus:outline-none"
          >
            <option value="">{t('common.all')}</option>
            {allQuotes.map((quote) => (
              <option key={quote} value={quote}>
                {quote}
              </option>
            ))}
          </select>
        </label>

        <div className="ml-auto flex items-center gap-1">
          {loading && <Spinner className="text-muted" />}
          <button
            type="button"
            onClick={() => setPaused(!paused)}
            className={`btn h-7 text-2xs ${paused ? 'btn-accent' : ''}`}
            title={paused ? t('common.resume') : t('common.pause')}
            aria-label={paused ? t('common.resume') : t('common.pause')}
            aria-pressed={paused}
          >
            {paused ? `▶ ${t('common.resume')}` : `❚❚ ${t('common.pause')}`}
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={rows.length === 0}
            className="btn h-7 text-2xs"
            title={t('common.exportCsv')}
            aria-label={t('common.exportCsv')}
          >
            ⭳ <span className="hidden sm:inline">{t('common.exportCsv')}</span>
          </button>
        </div>
      </div>

      <div
        className="grid items-center gap-1 border-b border-line bg-raised/40 px-2 py-1"
        style={{ gridTemplateColumns: template }}
        role="row"
      >
        {columns.map((column) => (
          <div
            key={column.id}
            role="columnheader"
            aria-sort={
              column.sortKey && sortKey === column.sortKey ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
            }
            className={`text-2xs font-semibold uppercase tracking-[0.05em] ${
              column.align === 'right' ? 'text-right' : 'text-left'
            } ${column.sortKey ? 'cursor-pointer select-none text-muted hover:text-ink' : 'text-muted'}`}
            onClick={() => toggleSort(column.sortKey)}
            title={column.sortKey ? `${column.label} — ${t('common.search')}` : undefined}
          >
            {column.label}
            {column.sortKey && sortKey === column.sortKey && (
              <span aria-hidden="true" className="ml-0.5 text-[8px]">
                {sortDir === 'asc' ? '▲' : '▼'}
              </span>
            )}
          </div>
        ))}
      </div>

      <div ref={attachObserver} onScroll={onScroll} className={`relative overflow-y-auto ${heightClass}`} role="rowgroup">
        {error && rows.length === 0 ? (
          <ErrorState reason={error} exchange={errorExchange ? sourceLabel(errorExchange, lang) : undefined} onRetry={onRetry} />
        ) : rows.length === 0 && loading ? (
          <TableSkeleton rows={10} />
        ) : rows.length === 0 ? (
          <EmptyState message={emptyMessage ?? t('markets.emptyFiltered')} hint={t('markets.virtualizedHint')} />
        ) : (
          <div style={{ height: rows.length * ROW_HEIGHT, position: 'relative' }}>
            {visibleRows.map((ticker, index) => {
              const absoluteIndex = start + index;
              const favorite = favoriteIds.includes(ticker.id);
              return (
                <div
                  key={ticker.id}
                  role="row"
                  style={{
                    gridTemplateColumns: template,
                    position: 'absolute',
                    top: absoluteIndex * ROW_HEIGHT,
                    left: 0,
                    right: 0,
                    height: ROW_HEIGHT,
                  }}
                  className={`grid cursor-pointer items-center gap-1 border-b border-line/40 px-2 text-xs transition-colors hover:bg-raised/70 ${
                    absoluteIndex % 2 === 0 ? 'bg-transparent' : 'bg-raised/20'
                  }`}
                  onClick={() => {
                    useWatchlist.getState().pushRecent(ticker.id);
                    openPair(ticker.exchange, ticker.rawSymbol);
                  }}
                >
                  {columns.map((column) => {
                    switch (column.id) {
                      case 'star':
                        return (
                          <div key={column.id} className="flex items-center">
                            <StarButton active={favorite} onToggle={() => toggleFavorite(ticker.id)} />
                          </div>
                        );
                      case 'pair':
                        return (
                          <div key={column.id} className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate font-mono text-xs font-medium text-ink">{ticker.symbol}</span>
                            <span className="hidden shrink-0 rounded bg-raised px-1 text-[9px] font-semibold uppercase tracking-wide text-muted sm:inline">
                              {sourceLabel(ticker.exchange, lang)}
                            </span>
                          </div>
                        );
                      case 'price':
                        return (
                          <div key={column.id} className="text-right num text-xs text-ink">
                            <PriceFlash value={formatPrice(ticker.price, lang)} />
                          </div>
                        );
                      case 'change':
                        return (
                          <div key={column.id} className="text-right">
                            <Delta value={ticker.changePercent24h} />
                          </div>
                        );
                      case 'high':
                        return (
                          <div key={column.id} className="text-right num text-2xs text-muted">
                            {formatPrice(ticker.high24h, lang)}
                          </div>
                        );
                      case 'low':
                        return (
                          <div key={column.id} className="text-right num text-2xs text-muted">
                            {formatPrice(ticker.low24h, lang)}
                          </div>
                        );
                      case 'volume':
                        return (
                          <div key={column.id} className="text-right num text-2xs text-muted">
                            {formatCompact(ticker.volume24h, lang)}
                          </div>
                        );
                      case 'turnover':
                        return (
                          <div key={column.id} className="text-right num text-2xs text-muted">
                            {formatCompact(ticker.quoteVolume24h, lang)}
                          </div>
                        );
                      case 'funding':
                        return (
                          <div key={column.id} className="text-right num text-2xs">
                            <span className={ticker.fundingRate === null ? 'text-muted' : ticker.fundingRate >= 0 ? 'text-up' : 'text-down'}>
                              {formatRatioAsPercent(ticker.fundingRate, 4)}
                            </span>
                          </div>
                        );
                      case 'source':
                        return (
                          <div key={column.id} className="truncate text-2xs text-muted">
                            {sourceLabel(ticker.exchange, lang)}
                          </div>
                        );
                      default:
                        return <div key={column.id} />;
                    }
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-line px-2 py-1 text-[10px] text-muted">
        <span>{t('markets.showing', { shown: rows.length, total: tickers.length })}</span>
        <span className="hidden sm:inline">{t('markets.virtualizedHint')}</span>
      </div>
    </section>
  );
}
