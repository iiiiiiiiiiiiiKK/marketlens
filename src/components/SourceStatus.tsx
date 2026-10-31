import { useLang, useT } from '../hooks/useI18n';
import { useNow } from '../hooks/useNow';
import { useMarkets } from '../store/markets';
import { useSettings } from '../store/settings';
import { refreshAll } from '../data/controller';
import { sourceLabel } from '../data';
import { EXCHANGE_IDS } from '../data';
import { formatAge, formatClock } from '../lib/format';
import { LiveDot, Pill, Spinner } from './ui';
import { reasonMessageKey } from '../lib/reasons';

/**
 * The honesty strip: what is live, what is stale, what failed, and where it
 * came from. Shown on every view so a degraded state can never be mistaken for
 * fresh data.
 */
export function SourceStatus({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const lang = useLang();
  const now = useNow(2000);
  const sources = useMarkets((state) => state.sources);
  const paused = useSettings((state) => state.paused);
  const setPaused = useSettings((state) => state.setPaused);
  const anyRefreshing = EXCHANGE_IDS.some((id) => sources[id]?.refreshing);

  return (
    <section
      className="panel flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1"
      aria-label={t('settings.sources')}
    >
      {EXCHANGE_IDS.map((id) => {
        const source = sources[id];
        const status = source.status;
        const tone = status === 'error' ? 'down' : status === 'ready' ? 'up' : status === 'loading' ? 'warn' : 'muted';
        const label =
          status === 'error'
            ? t(reasonMessageKey(source.error))
            : source.updatedAt
              ? formatAge(source.updatedAt, now, lang)
              : t('common.loading');
        return (
          <span key={id} className="flex items-center gap-1" title={`${sourceLabel(id, lang)} — ${label}`}>
            <LiveDot tone={tone} />
            <span className="text-[10px] font-medium text-ink">{sourceLabel(id, lang)}</span>
            {!compact && (
              <span className={`text-[10px] ${status === 'error' ? 'text-down' : 'text-muted'}`}>{label}</span>
            )}
          </span>
        );
      })}

      <div className="ml-auto flex items-center gap-1.5">
        {paused && (
          <span className="text-[10px] font-medium text-amber-500" title={t('status.pausedHint')}>
            {t('status.paused')}
          </span>
        )}
        {anyRefreshing && <Spinner className="text-muted" />}
        <button type="button" onClick={() => void refreshAll()} className="btn btn-ghost h-6 text-[10px]" title={t('common.refreshNow')}>
          ↻
        </button>
        <button
          type="button"
          onClick={() => setPaused(!paused)}
          className={`btn h-6 text-[10px] ${paused ? 'btn-accent' : ''}`}
        >
          {paused ? t('common.resume') : t('common.pause')}
        </button>
        {!compact && <Pill tone={paused ? 'warn' : 'neutral'}>{formatClock(now, lang, false)}</Pill>}
      </div>
    </section>
  );
}
