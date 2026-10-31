import { useEffect, useState } from 'react';
import { useT } from '../hooks/useI18n';
import { useNow } from '../hooks/useNow';
import { formatAge } from '../lib/format';
import { AUTHOR_URL, REPO_URL } from '../lib/constants';
import { navigate } from '../lib/router';
import type { Route, View } from '../lib/router';
import { useSettings } from '../store/settings';
import { okSourceCount, useMarkets } from '../store/markets';
import { EXCHANGE_IDS } from '../data';
import { LiveDot, Pill } from './ui';

const NAV: Array<{ view: View; key: 'nav.markets' | 'nav.spot' | 'nav.futures' | 'nav.compare' | 'nav.watchlist' }> = [
  { view: 'markets', key: 'nav.markets' },
  { view: 'spot', key: 'nav.spot' },
  { view: 'futures', key: 'nav.futures' },
  { view: 'compare', key: 'nav.compare' },
  { view: 'watchlist', key: 'nav.watchlist' },
];

export function BrandMark({ compact = false }: { compact?: boolean }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={() => navigate({ view: 'markets', exchange: null, rawSymbol: null, comparePair: null })}
      className="group flex min-w-0 items-center gap-2"
      aria-label={t('brand.name')}
    >
      <span className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded border border-line bg-raised">
        <span className="absolute h-[2px] w-3 rotate-[-28deg] rounded bg-accent" />
        <span className="absolute right-1 top-1 h-1 w-1 rounded-full bg-up" />
      </span>
      <span className="flex min-w-0 flex-col leading-none">
        <span className="whitespace-nowrap text-sm font-semibold tracking-tight text-ink">MarketLens</span>
        {!compact && (
          <span className="hidden whitespace-nowrap text-[10px] font-medium tracking-wide text-muted sm:block">
            {t('brand.tagline')}
          </span>
        )}
      </span>
    </button>
  );
}

export function XLink({ className = '' }: { className?: string }) {
  const t = useT();
  return (
    <a
      href={AUTHOR_URL}
      target="_blank"
      rel="noreferrer noopener"
      title={`${t('brand.author')}: @0xkillcoin`}
      aria-label={`${t('brand.author')} 𝕏 @0xkillcoin`}
      className={`inline-flex h-7 items-center gap-1 rounded border border-line px-2 text-xs font-semibold text-muted transition-colors hover:border-ink/30 hover:text-ink ${className}`}
    >
      <span aria-hidden="true" className="text-[13px] leading-none">
        𝕏
      </span>
      <span className="hidden font-mono text-[10px] sm:inline">0xkillcoin</span>
    </a>
  );
}

function ThemeToggle() {
  const t = useT();
  const theme = useSettings((state) => state.theme);
  const toggleTheme = useSettings((state) => state.toggleTheme);
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="btn btn-ghost h-7 w-7 px-0"
      aria-label={`${t('theme.toggle')} (${theme})`}
      title={theme === 'dark' ? t('theme.light') : t('theme.dark')}
    >
      <span aria-hidden="true" className="text-sm leading-none">
        {theme === 'dark' ? '☀' : '☾'}
      </span>
    </button>
  );
}

function LangToggle() {
  const t = useT();
  const lang = useSettings((state) => state.lang);
  const setLang = useSettings((state) => state.setLang);
  return (
    <button
      type="button"
      onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
      className="btn btn-ghost h-7 px-1.5 font-mono text-[10px] font-semibold"
      aria-label={t('lang.toggle')}
      title={t('lang.toggle')}
    >
      {lang === 'zh' ? '中' : 'EN'}
    </button>
  );
}

export function ConnectionPill() {
  const t = useT();
  const lang = useSettings((state) => state.lang);
  const sources = useMarkets((state) => state.sources);
  const paused = useSettings((state) => state.paused);
  const now = useNow(2000);
  const ok = okSourceCount(sources);
  const updatedAt = Math.max(
    0,
    ...EXCHANGE_IDS.map((id) => sources[id]?.updatedAt ?? 0),
  );
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (offline) {
    return (
      <Pill tone="down" title={t('error.offline.body')}>
        <LiveDot tone="down" />
        {t('status.offline')}
      </Pill>
    );
  }

  if (paused) {
    return (
      <Pill tone="warn" title={t('status.pausedHint')}>
        <LiveDot tone="warn" />
        {t('status.paused')}
      </Pill>
    );
  }

  if (ok === 0) {
    return (
      <Pill tone="down" title={t('status.sourcesOk', { ok, total: EXCHANGE_IDS.length })}>
        <LiveDot tone="down" />
        {t('status.degraded')}
      </Pill>
    );
  }

  const stale = updatedAt > 0 && now - updatedAt > 45_000;
  return (
    <Pill
      tone={ok === EXCHANGE_IDS.length ? (stale ? 'warn' : 'up') : 'warn'}
      title={`${t('status.sourcesOk', { ok, total: EXCHANGE_IDS.length })} · ${formatAge(updatedAt, now, lang)}`}
    >
      <LiveDot tone={ok === EXCHANGE_IDS.length ? (stale ? 'warn' : 'up') : 'warn'} />
      <span className="hidden sm:inline">{stale ? t('status.stale') : t('status.live')}</span>
      <span className="sm:hidden">{ok}/{EXCHANGE_IDS.length}</span>
    </Pill>
  );
}

export function TopNav({
  route,
  onOpenSearch,
  onOpenMenu,
}: {
  route: Route;
  onOpenSearch: () => void;
  onOpenMenu: () => void;
}) {
  const t = useT();
  const isMobile = useMobileNav();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-panel/95 backdrop-blur supports-[backdrop-filter]:bg-panel/80">
      <div className="mx-auto flex h-12 max-w-[1800px] items-center gap-2 px-2 sm:px-3">
        <BrandMark compact={isMobile} />

        <nav className="ml-2 hidden items-center gap-0.5 md:flex" aria-label={t('nav.menu')}>
          {NAV.map((item) => {
            const active = route.view === item.view;
            return (
              <button
                key={item.view}
                type="button"
                onClick={() => navigate({ view: item.view, exchange: null, rawSymbol: null, comparePair: null })}
                aria-current={active ? 'page' : undefined}
                className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                  active ? 'bg-raised text-ink' : 'text-muted hover:bg-raised/70 hover:text-ink'
                }`}
              >
                {t(item.key)}
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenSearch}
            className="flex h-7 items-center gap-1.5 rounded border border-line bg-raised/60 px-2 text-2xs text-muted transition-colors hover:border-ink/25 hover:text-ink"
            aria-label={t('common.search')}
          >
            <span aria-hidden="true">⌕</span>
            <span className="hidden lg:inline">{t('common.search')}</span>
            <kbd className="hidden rounded border border-line px-1 font-mono text-[9px] text-muted lg:inline">/</kbd>
          </button>

          <div className="hidden sm:block">
            <ConnectionPill />
          </div>

          <XLink />
          <LangToggle />
          <ThemeToggle />

          <button
            type="button"
            onClick={onOpenMenu}
            className="btn btn-ghost h-7 w-7 px-0 md:hidden"
            aria-label={t('nav.menu')}
          >
            <span aria-hidden="true" className="text-sm leading-none">
              ☰
            </span>
          </button>

          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="hidden h-7 items-center rounded border border-line px-2 text-2xs text-muted transition-colors hover:text-ink lg:inline-flex"
            aria-label="GitHub"
            title="GitHub"
          >
            <span aria-hidden="true" className="font-mono text-[11px]">
              ⌥
            </span>
          </a>
        </div>
      </div>
    </header>
  );
}

/** Kept local to avoid a hook import cycle in the header. */
function useMobileNav(): boolean {
  const [mobile, setMobile] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia('(max-width: 639px)').matches,
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const list = window.matchMedia('(max-width: 639px)');
    const onChange = (event: MediaQueryListEvent) => setMobile(event.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, []);
  return mobile;
}
