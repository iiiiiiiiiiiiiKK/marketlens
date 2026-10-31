import { useLang, useT } from '../hooks/useI18n';
import { useSettings, REFRESH_OPTIONS } from '../store/settings';
import { ADAPTERS } from '../data';
import { APP_VERSION, AUTHOR_URL, LICENSE, REPO_URL } from '../lib/constants';
import { Segmented, Toggle } from '../components/ui';
import { reschedulePolling, refreshAll } from '../data/controller';

export function SettingsView() {
  const t = useT();
  const lang = useLang();
  const theme = useSettings((state) => state.theme);
  const setTheme = useSettings((state) => state.setTheme);
  const setLang = useSettings((state) => state.setLang);
  const refreshIntervalMs = useSettings((state) => state.refreshIntervalMs);
  const setRefreshInterval = useSettings((state) => state.setRefreshInterval);
  const paused = useSettings((state) => state.paused);
  const setPaused = useSettings((state) => state.setPaused);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
      <h1 className="px-0.5 text-sm font-semibold tracking-tight text-ink">{t('settings.title')}</h1>

      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">{t('settings.appearance')}</h2>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-2">
          <span className="text-xs text-ink">{t('settings.theme')}</span>
          <Segmented
            options={[
              { value: 'dark', label: t('theme.dark') },
              { value: 'light', label: t('theme.light') },
            ]}
            value={theme}
            onChange={setTheme}
            ariaLabel={t('settings.theme')}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-2 py-2">
          <span className="text-xs text-ink">{t('settings.language')}</span>
          <Segmented
            options={[
              { value: 'zh', label: t('lang.zh') },
              { value: 'en', label: t('lang.en') },
            ]}
            value={lang}
            onChange={setLang}
            ariaLabel={t('settings.language')}
          />
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">{t('settings.data')}</h2>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-2">
          <div>
            <span className="text-xs text-ink">{t('settings.refreshInterval')}</span>
            <p className="mt-0.5 max-w-md text-2xs leading-relaxed text-muted">{t('settings.refreshHint')}</p>
          </div>
          <div className="flex items-center gap-1">
            <Segmented
              options={REFRESH_OPTIONS.map((ms) => ({ value: String(ms), label: `${ms / 1000}s` }))}
              value={String(refreshIntervalMs)}
              onChange={(value) => {
                setRefreshInterval(Number(value));
                reschedulePolling();
              }}
              ariaLabel={t('settings.refreshInterval')}
            />
            <button type="button" className="btn h-6 text-2xs" onClick={() => void refreshAll()}>
              {t('common.refreshNow')}
            </button>
          </div>
        </div>
        <div className="border-t border-line px-2 py-1">
          <Toggle
            checked={paused}
            onChange={(value) => {
              setPaused(value);
              reschedulePolling();
            }}
            label={t('settings.pause')}
            hint={t('status.pausedHint')}
          />
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">{t('settings.sources')}</h2>
        </div>
        <p className="px-2 pt-1.5 text-2xs leading-relaxed text-muted">{t('settings.sourcesBody')}</p>
        <ul className="mt-1 divide-y divide-line/60">
          {ADAPTERS.map((adapter) => (
            <li key={adapter.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-2 py-1.5">
              <span className="w-32 shrink-0 text-xs font-medium text-ink">
                {adapter.label} {adapter.kind === 'spot' ? t('common.spot') : t('common.futures')}
              </span>
              <code className="truncate font-mono text-[10px] text-muted">{adapter.endpoint}</code>
              <a
                href={adapter.docsUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="ml-auto text-[10px] text-accent hover:underline"
              >
                API docs ↗
              </a>
            </li>
          ))}
        </ul>
        <p className="border-t border-line px-2 py-1.5 text-2xs leading-relaxed text-muted">{t('settings.rateLimitsBody')}</p>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">{t('settings.privacy')}</h2>
        </div>
        <p className="px-2 py-1.5 text-2xs leading-relaxed text-muted">{t('settings.privacyBody')}</p>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">{t('settings.about')}</h2>
        </div>
        <div className="space-y-1 px-2 py-1.5 text-2xs text-muted">
          <p>
            MarketLens — {t('brand.tagline')} · {t('settings.version', { v: APP_VERSION })}
          </p>
          <p>
            {t('brand.author')}:{' '}
            <a href={AUTHOR_URL} target="_blank" rel="noreferrer noopener" className="text-accent hover:underline">
              𝕏 @0xkillcoin
            </a>
          </p>
          <p>
            {t('footer.source')}:{' '}
            <a href={REPO_URL} target="_blank" rel="noreferrer noopener" className="text-accent hover:underline">
              {REPO_URL.replace('https://', '')}
            </a>
          </p>
          <p>{LICENSE}</p>
        </div>
      </section>
    </div>
  );
}
