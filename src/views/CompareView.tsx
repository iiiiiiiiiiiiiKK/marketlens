import { useEffect, useMemo, useState } from 'react';
import { useLang, useT } from '../hooks/useI18n';
import { flattenTickers, useMarkets } from '../store/markets';
import { buildCompare, comparablePairs } from '../lib/selectors';
import { formatClock, formatCompact, formatPrice } from '../lib/format';
import { sourceLabel } from '../data';
import { openPair } from '../lib/router';
import { Delta, EmptyState, Pill, Skeleton } from '../components/ui';
import { SourceStatus } from '../components/SourceStatus';

export function CompareView({ initialPair }: { initialPair: string | null }) {
  const t = useT();
  const lang = useLang();
  const sources = useMarkets((state) => state.sources);
  const tickers = useMemo(() => flattenTickers(sources), [sources]);
  const pairs = useMemo(() => comparablePairs(tickers), [tickers]);
  const [selected, setSelected] = useState<string | null>(initialPair);
  /** Set once the visitor picks a pair, so auto-selection stops overriding it. */
  const [userPicked, setUserPicked] = useState(Boolean(initialPair));

  // Keep converging on the best default until the visitor chooses explicitly —
  // sources arrive progressively, so the first loaded pair may be a thin one.
  useEffect(() => {
    if (userPicked) return;
    const preferred = pairs.find((pair) => pair.base === 'BTC' && pair.quote === 'USDT') ?? pairs[0];
    if (preferred) {
      const next = `${preferred.base}/${preferred.quote}`;
      if (next !== selected) setSelected(next);
    }
  }, [pairs, selected, userPicked]);

  const pickPair = (pair: string) => {
    setUserPicked(true);
    setSelected(pair);
  };

  const [base, quote] = (selected ?? '/').split('/');
  const result = useMemo(
    () => (base && quote ? buildCompare(tickers, base, quote) : null),
    [tickers, base, quote],
  );
  const loading = Object.values(sources).every((source) => source.status === 'idle' || source.status === 'loading');

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-1 px-0.5">
        <div className="flex items-baseline gap-2">
          <h1 className="text-sm font-semibold tracking-tight text-ink">{t('compare.title')}</h1>
          <p className="hidden text-[10px] text-muted sm:block">{t('compare.subtitle')}</p>
        </div>
        <div className="flex items-center gap-1">
          {['BTC/USDT', 'ETH/USDT', 'SOL/USDT'].map((pair) => (
            <button
              key={pair}
              type="button"
              onClick={() => pickPair(pair)}
              className={`rounded border px-1.5 py-0.5 text-2xs ${
                selected === pair ? 'border-accent/60 bg-accent/15 text-accent' : 'border-line text-muted hover:text-ink'
              }`}
            >
              {pair}
            </button>
          ))}
          <select
            value={selected ?? ''}
            onChange={(event) => pickPair(event.target.value)}
            aria-label={t('compare.selectPair')}
            className="h-6 max-w-[160px] rounded border border-line bg-panel px-1 text-2xs text-ink focus:border-accent/70 focus:outline-none"
          >
            {pairs.map((pair) => (
              <option key={`${pair.base}/${pair.quote}`} value={`${pair.base}/${pair.quote}`}>
                {pair.base}/{pair.quote} ({pair.venues})
              </option>
            ))}
          </select>
        </div>
      </div>

      <SourceStatus compact />

      <section className="panel" aria-label={t('compare.title')}>
        {loading && pairs.length === 0 ? (
          <div className="space-y-1 p-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-4 w-full" />
            ))}
          </div>
        ) : result && result.rows.length === 0 ? (
          <EmptyState message={t('markets.emptyFiltered')} />
        ) : result ? (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-2 py-1.5">
              <span className="font-mono text-xs font-semibold text-ink">
                {base}/{quote}
              </span>
              <span className="num text-2xs text-muted">
                {t('compare.diff')} · median {formatPrice(result.medianPrice, lang)}
              </span>
              {result.rows.length === 1 && <Pill tone="warn">{t('compare.singleVenue')}</Pill>}
              {result.kindMismatch && <Pill tone="warn">{t('compare.kindMismatch')}</Pill>}
              {result.bestAsk && (
                <Pill tone="up">
                  {t('compare.cheapest')}: {sourceLabel(result.bestAsk.ticker.exchange, lang)} ·{' '}
                  {formatPrice(result.bestAsk.ticker.ask, lang)}
                </Pill>
              )}
              {result.bestBid && (
                <Pill tone="down">
                  {t('compare.bestBid')}: {sourceLabel(result.bestBid.ticker.exchange, lang)} ·{' '}
                  {formatPrice(result.bestBid.ticker.bid, lang)}
                </Pill>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-xs">
                <thead>
                  <tr className="border-b border-line bg-raised/40 text-[10px] uppercase tracking-wide text-muted">
                    <th className="px-2 py-1 text-left font-semibold">{t('common.exchange')}</th>
                    <th className="px-2 py-1 text-left font-semibold">{t('common.kind')}</th>
                    <th className="px-2 py-1 text-right font-semibold">{t('common.price')}</th>
                    <th className="px-2 py-1 text-right font-semibold">{t('common.change24h')}</th>
                    <th className="px-2 py-1 text-right font-semibold">{t('compare.spread')}</th>
                    <th className="px-2 py-1 text-right font-semibold">{t('compare.diff')}</th>
                    <th className="px-2 py-1 text-right font-semibold">{t('common.quoteVolume24h')}</th>
                    <th className="px-2 py-1 text-right font-semibold">{t('common.updated')}</th>
                    <th className="px-2 py-1" />
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr key={row.ticker.id} className="border-b border-line/50 hover:bg-raised/50">
                      <td className="px-2 py-1.5 text-ink">{sourceLabel(row.ticker.exchange, lang)}</td>
                      <td className="px-2 py-1.5 text-muted">
                        {row.ticker.kind === 'spot' ? t('common.spot') : t('common.futures')}
                      </td>
                      <td className="num px-2 py-1.5 text-right text-ink">{formatPrice(row.ticker.price, lang)}</td>
                      <td className="px-2 py-1.5 text-right">
                        <Delta value={row.ticker.changePercent24h} />
                      </td>
                      <td className="num px-2 py-1.5 text-right text-muted">
                        {row.spreadPct === null ? '—' : `${row.spreadPct.toFixed(3)}%`}
                      </td>
                      <td className="num px-2 py-1.5 text-right">
                        {row.diffFromMedianPct === null ? (
                          '—'
                        ) : (
                          <span className={row.diffFromMedianPct > 0 ? 'text-up' : row.diffFromMedianPct < 0 ? 'text-down' : 'text-muted'}>
                            {row.diffFromMedianPct > 0 ? '+' : ''}
                            {row.diffFromMedianPct.toFixed(3)}%
                          </span>
                        )}
                      </td>
                      <td className="num px-2 py-1.5 text-right text-muted">{formatCompact(row.ticker.quoteVolume24h, lang)}</td>
                      <td className="num px-2 py-1.5 text-right text-muted">{formatClock(row.ticker.timestamp, lang, false)}</td>
                      <td className="px-2 py-1.5 text-right">
                        <button
                          type="button"
                          onClick={() => openPair(row.ticker.exchange, row.ticker.rawSymbol)}
                          className="btn btn-ghost h-6 px-1.5 text-2xs"
                        >
                          {t('search.open')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-0.5 border-t border-line px-2 py-1.5 text-[10px] leading-relaxed text-muted">
              <p>• {t('compare.spreadNote')}</p>
              <p>• {t('compare.diffNote')}</p>
              <p>• {t('compare.timestampNote')}</p>
            </div>
          </>
        ) : (
          <EmptyState message={t('markets.emptyFiltered')} />
        )}
      </section>
    </div>
  );
}
