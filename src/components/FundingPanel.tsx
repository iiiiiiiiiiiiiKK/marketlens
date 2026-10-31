import { useLang, useT } from '../hooks/useI18n';
import { useFunding } from '../hooks/useFunding';
import { useNow } from '../hooks/useNow';
import { formatClock, formatDateTime, formatPrice, formatRatioAsPercent } from '../lib/format';
import { sourceLabel } from '../data';
import type { ExchangeId } from '../lib/types';
import { EmptyState, ErrorState, Pill, Skeleton } from './ui';

/** Countdown text for the next funding settlement. */
function untilNext(nextFundingTime: number | null, now: number, template: (h: number, m: number) => string): string | null {
  if (!nextFundingTime) return null;
  const diff = nextFundingTime - now;
  if (diff <= 0) return null;
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return template(hours, minutes);
}

export function FundingPanel({
  exchange,
  rawSymbol,
  symbol,
  compact = false,
}: {
  exchange: ExchangeId;
  rawSymbol: string;
  symbol: string;
  compact?: boolean;
}) {
  const t = useT();
  const lang = useLang();
  const now = useNow(1000);
  const { snapshot, history, status, error } = useFunding(exchange, rawSymbol);

  const isFutures = exchange === 'binance-futures' || exchange === 'bybit-linear';

  if (!isFutures) {
    return (
      <section className="panel flex flex-col" aria-label={t('funding.title')}>
        <div className="panel-head">
          <h2 className="panel-title">{t('funding.title')}</h2>
          <span className="num text-2xs text-muted">{symbol}</span>
        </div>
        <EmptyState message={t('funding.onlyPerpetual')} hint={t('funding.disclaimer')} />
      </section>
    );
  }

  if (status === 'error' && !snapshot) {
    return (
      <section className="panel flex flex-col" aria-label={t('funding.title')}>
        <div className="panel-head">
          <h2 className="panel-title">{t('funding.title')}</h2>
        </div>
        <ErrorState reason={error} exchange={sourceLabel(exchange, lang)} compact />
      </section>
    );
  }

  const maxAbsRate = Math.max(0.0001, ...history.map((point) => Math.abs(point.rate)));

  return (
    <section className="panel flex flex-col" aria-label={t('funding.title')}>
      <div className="panel-head">
        <h2 className="panel-title">{t('funding.title')}</h2>
        <span className="num text-2xs text-muted">
          {symbol} · {sourceLabel(exchange, lang)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 px-2 py-2">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted">{t('funding.rate')}</p>
          {status === 'loading' && !snapshot ? (
            <Skeleton className="mt-1 h-4 w-16" />
          ) : (
            <p
              className={`num text-sm font-semibold ${
                snapshot?.rate === null || snapshot?.rate === undefined
                  ? 'text-muted'
                  : snapshot.rate >= 0
                    ? 'text-up'
                    : 'text-down'
              }`}
            >
              {formatRatioAsPercent(snapshot?.rate ?? null, 4)}
            </p>
          )}
          <p className="mt-0.5 text-[9px] leading-tight text-muted">
            {snapshot?.rate === null || snapshot?.rate === undefined
              ? ''
              : snapshot.rate >= 0
                ? t('funding.positiveHint')
                : t('funding.negativeHint')}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted">{t('funding.next')}</p>
          <p className="num text-sm font-semibold text-ink">
            {snapshot?.nextFundingTime ? formatClock(snapshot.nextFundingTime, lang, false) : '—'}
          </p>
          <p className="mt-0.5 text-[9px] leading-tight text-muted">
            {untilNext(snapshot?.nextFundingTime ?? null, now, (h, m) => t('funding.inHours', { h, m })) ?? '—'}
          </p>
        </div>
      </div>

      {snapshot?.markPrice !== null && snapshot?.markPrice !== undefined && (
        <div className="flex items-center justify-between border-t border-line px-2 py-1 text-[10px] text-muted">
          <span>{t('pair.markPrice')}</span>
          <span className="num text-ink">{formatPrice(snapshot.markPrice, lang)}</span>
        </div>
      )}

      <div className="border-t border-line px-2 py-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{t('funding.history')}</p>
        {history.length === 0 ? (
          <p className="py-1 text-2xs text-muted">{t('funding.noHistory')}</p>
        ) : (
          <ul className={`mt-1 space-y-[3px] overflow-y-auto ${compact ? 'max-h-24' : 'max-h-40'}`}>
            {history
              .slice(-14)
              .reverse()
              .map((point) => {
                const width = Math.max(2, (Math.abs(point.rate) / maxAbsRate) * 100);
                return (
                  <li key={point.time} className="flex items-center gap-1.5 text-[10px]">
                    <span className="num w-[92px] shrink-0 text-muted">{formatDateTime(point.time, lang).slice(0, 10)}</span>
                    <span className="relative h-2 flex-1 overflow-hidden rounded bg-raised">
                      <span
                        className={point.rate >= 0 ? 'absolute inset-y-0 left-0 bg-up/60' : 'absolute inset-y-0 right-0 bg-down/60'}
                        style={{ width: `${width}%` }}
                      />
                    </span>
                    <span className={`num w-[58px] shrink-0 text-right ${point.rate >= 0 ? 'text-up' : 'text-down'}`}>
                      {formatRatioAsPercent(point.rate, 4)}
                    </span>
                  </li>
                );
              })}
          </ul>
        )}
      </div>

      <p className="border-t border-line px-2 py-1 text-[10px] leading-relaxed text-muted">{t('funding.disclaimer')}</p>
      <div className="flex items-center gap-1 border-t border-line px-2 py-1">
        <Pill tone="neutral">{sourceLabel(exchange, lang)}</Pill>
        <span className="text-[9px] text-muted">{t('common.updated')} {formatClock(Date.now(), lang, false)}</span>
      </div>
    </section>
  );
}
