import { useMemo, useState } from 'react';
import { useLang, useT } from '../hooks/useI18n';
import { useNow } from '../hooks/useNow';
import { useOrderBook } from '../hooks/useOrderBook';
import { formatAge, formatClock, formatPrice, formatQuantity, midPrice, spreadPercent } from '../lib/format';
import { sourceLabel } from '../data';
import type { ExchangeId, OrderBookLevel } from '../lib/types';
import { EmptyState, ErrorState, Segmented, Skeleton } from './ui';

const DEPTH_OPTIONS = [15, 50, 100] as const;

function cumulative(levels: OrderBookLevel[]): Array<OrderBookLevel & { total: number }> {
  let running = 0;
  return levels.map((level) => {
    running += level.qty;
    return { ...level, total: running };
  });
}

export function OrderBookPanel({
  exchange,
  rawSymbol,
  symbol,
  rows = 14,
  heightClass = '',
}: {
  exchange: ExchangeId;
  rawSymbol: string;
  symbol: string;
  rows?: number;
  heightClass?: string;
}) {
  const t = useT();
  const lang = useLang();
  const now = useNow(1000);
  const [depth, setDepth] = useState<number>(50);
  const { book, status, error, reload } = useOrderBook(exchange, rawSymbol, depth);

  const bids = useMemo(() => cumulative(book?.bids ?? []).slice(0, rows), [book, rows]);
  const asks = useMemo(() => cumulative(book?.asks ?? []).slice(0, rows), [book, rows]);
  const maxTotal = Math.max(1, bids.at(-1)?.total ?? 1, asks.at(-1)?.total ?? 1);
  const spread = book ? spreadPercent(book.bids[0]?.price ?? null, book.asks[0]?.price ?? null) : null;
  const mid = book ? midPrice(book.bids[0]?.price ?? null, book.asks[0]?.price ?? null) : null;
  const bidVolume = bids.reduce((sum, level) => sum + level.qty, 0);
  const askVolume = asks.reduce((sum, level) => sum + level.qty, 0);
  const bidShare = bidVolume + askVolume > 0 ? (bidVolume / (bidVolume + askVolume)) * 100 : null;

  return (
    <section className="panel flex min-h-0 flex-col" aria-label={`${symbol} ${t('book.title')}`}>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-2 py-1.5">
        <h2 className="panel-title">{t('book.title')}</h2>
        <span className="num text-2xs text-muted">
          {symbol} · {sourceLabel(exchange, lang)}
        </span>
        <div className="ml-auto">
          <Segmented
            options={DEPTH_OPTIONS.map((value) => ({ value: String(value), label: String(value) }))}
            value={String(depth)}
            onChange={(value) => setDepth(Number(value))}
            ariaLabel={t('book.levels')}
          />
        </div>
      </div>

      {status === 'error' && !book ? (
        <ErrorState reason={error} exchange={sourceLabel(exchange, lang)} onRetry={reload} compact />
      ) : status === 'loading' && !book ? (
        <div className={`space-y-1 p-2 ${heightClass}`}>
          {Array.from({ length: 12 }).map((_, index) => (
            <Skeleton key={index} className="h-3 w-full" />
          ))}
        </div>
      ) : !book || (bids.length === 0 && asks.length === 0) ? (
        <EmptyState message={t('book.unavailable')} />
      ) : (
        <div className={`flex min-h-0 flex-col ${heightClass}`}>
          <div className="grid grid-cols-3 gap-1 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-muted">
            <span>{t('common.price')}</span>
            <span className="text-right">{t('book.qty')}</span>
            <span className="text-right">{t('book.total')}</span>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-hidden">
              {asks
                .slice()
                .reverse()
                .map((level) => (
                  <div key={`ask-${level.price}`} className="relative grid grid-cols-3 gap-1 px-2 py-[1px] text-2xs">
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-0 right-0 bg-down/10"
                      style={{ width: `${(level.total / maxTotal) * 100}%` }}
                    />
                    <span className="relative num text-down">{formatPrice(level.price, lang)}</span>
                    <span className="relative num text-right text-muted">{formatQuantity(level.qty)}</span>
                    <span className="relative num text-right text-muted/80">{formatQuantity(level.total)}</span>
                  </div>
                ))}
            </div>

            <div className="my-0.5 flex items-center justify-between gap-2 border-y border-line px-2 py-1">
              <span className="num text-xs font-semibold text-ink">{formatPrice(mid, lang)}</span>
              <span className="num text-[10px] text-muted">
                {t('book.spread')} {spread === null ? '—' : `${spread.toFixed(3)}%`}
              </span>
            </div>

            <div className="flex-1 overflow-hidden">
              {bids.map((level) => (
                <div key={`bid-${level.price}`} className="relative grid grid-cols-3 gap-1 px-2 py-[1px] text-2xs">
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 right-0 bg-up/10"
                    style={{ width: `${(level.total / maxTotal) * 100}%` }}
                  />
                  <span className="relative num text-up">{formatPrice(level.price, lang)}</span>
                  <span className="relative num text-right text-muted">{formatQuantity(level.qty)}</span>
                  <span className="relative num text-right text-muted/80">{formatQuantity(level.total)}</span>
                </div>
              ))}
            </div>
          </div>

          {bidShare !== null && (
            <div className="border-t border-line px-2 py-1">
              <div className="flex items-center justify-between text-[10px] text-muted">
                <span>{t('book.imbalance')}</span>
                <span className="num">
                  {bidShare.toFixed(1)}% / {(100 - bidShare).toFixed(1)}%
                </span>
              </div>
              <div className="mt-1 flex h-1 overflow-hidden rounded bg-raised">
                <span className="bg-up" style={{ width: `${bidShare}%` }} />
                <span className="bg-down" style={{ width: `${100 - bidShare}%` }} />
              </div>
            </div>
          )}

          <p className="border-t border-line px-2 py-1 text-[10px] leading-relaxed text-muted">
            {t('book.note', {
              exchange: sourceLabel(exchange, lang),
              time: `${formatClock(book.timestamp, lang)} (${formatAge(book.fetchedAt, now, lang)})`,
            })}
          </p>
        </div>
      )}
    </section>
  );
}
