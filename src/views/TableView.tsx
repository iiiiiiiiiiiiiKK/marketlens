import { useMemo } from 'react';
import { useT } from '../hooks/useI18n';
import { flattenTickers, useMarkets } from '../store/markets';
import { MarketTable } from '../components/MarketTable';
import { HeroStrip } from '../components/HeroStrip';
import { SourceStatus } from '../components/SourceStatus';
import { refreshAll } from '../data/controller';
import { sourcesByKind } from '../data';
import type { ExchangeId, MarketKind } from '../lib/types';

/**
 * Shared table view used by Markets / Spot / Futures. `kind` narrows the
 * dataset; futures additionally surfaces funding columns.
 */
export function TableView({ kind }: { kind: MarketKind | null }) {
  const t = useT();
  const sources = useMarkets((state) => state.sources);
  const tickers = useMemo(() => flattenTickers(sources), [sources]);

  const relevant: ExchangeId[] = kind ? sourcesByKind(kind) : ['binance-spot', 'binance-futures', 'bybit-spot', 'bybit-linear'];
  const rows = useMemo(() => (kind ? tickers.filter((ticker) => ticker.kind === kind) : tickers), [tickers, kind]);
  const loading = relevant.some((id) => sources[id]?.status === 'loading' || sources[id]?.status === 'idle');
  const allFailed = relevant.every((id) => sources[id]?.status === 'error');
  const firstError = relevant.map((id) => sources[id]?.error).find(Boolean) ?? null;
  const firstErrorExchange = relevant.find((id) => sources[id]?.status === 'error');

  const title = kind === 'spot' ? t('nav.spot') : kind === 'futures' ? t('nav.futures') : t('markets.title');

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-1 px-0.5">
        <div className="flex items-baseline gap-2">
          <h1 className="text-sm font-semibold tracking-tight text-ink">{title}</h1>
          <p className="text-[10px] text-muted">{t('markets.subtitle')}</p>
        </div>
      </div>

      <HeroStrip />
      <SourceStatus />

      <MarketTable
        tickers={rows}
        loading={loading}
        error={allFailed ? firstError : null}
        errorExchange={firstErrorExchange}
        onRetry={() => void refreshAll()}
        fixedKind={kind}
        showFunding={kind === 'futures'}
        showKindFilter={kind === null}
        heightClass="h-[calc(100vh-330px)] min-h-[360px] sm:min-h-[420px]"
      />
    </div>
  );
}
