import { useT } from '../hooks/useI18n';
import { navigate } from '../lib/router';
import type { Route, View } from '../lib/router';

const TABS: Array<{ view: View; label: 'mobile.tab.dashboard' | 'nav.spot' | 'nav.futures' | 'nav.compare' | 'nav.watchlist'; glyph: string }> = [
  { view: 'markets', label: 'mobile.tab.dashboard', glyph: '▦' },
  { view: 'spot', label: 'nav.spot', glyph: '◉' },
  { view: 'futures', label: 'nav.futures', glyph: '◈' },
  { view: 'compare', label: 'nav.compare', glyph: '⚖' },
  { view: 'watchlist', label: 'nav.watchlist', glyph: '★' },
];

/** Bottom tab bar: the mobile counterpart of the desktop navigation. */
export function MobileTabBar({ route }: { route: Route }) {
  const t = useT();
  return (
    <nav
      data-testid="mobile-tabbar"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-panel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      aria-label={t('nav.menu')}
    >
      <ul className="flex items-stretch">
        {TABS.map((tab) => {
          const active = route.view === tab.view || (route.view === 'pair' && tab.view === 'markets');
          return (
            <li key={tab.view} className="flex-1">
              <button
                type="button"
                onClick={() => navigate({ view: tab.view, exchange: null, rawSymbol: null, comparePair: null })}
                aria-current={active ? 'page' : undefined}
                className={`flex w-full flex-col items-center gap-0.5 py-1.5 text-[10px] font-medium transition-colors ${
                  active ? 'text-accent' : 'text-muted'
                }`}
              >
                <span aria-hidden="true" className="text-sm leading-none">
                  {tab.glyph}
                </span>
                {t(tab.label)}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
