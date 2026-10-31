import { useT } from '../hooks/useI18n';
import { navigate } from '../lib/router';
import type { Route, View } from '../lib/router';
import { AUTHOR_URL, REPO_URL, APP_VERSION } from '../lib/constants';
import { Modal } from './ui';
import { useSettings } from '../store/settings';

const ITEMS: Array<{ view: View; label: 'nav.markets' | 'nav.spot' | 'nav.futures' | 'nav.compare' | 'nav.watchlist' | 'nav.settings' }> = [
  { view: 'markets', label: 'nav.markets' },
  { view: 'spot', label: 'nav.spot' },
  { view: 'futures', label: 'nav.futures' },
  { view: 'compare', label: 'nav.compare' },
  { view: 'watchlist', label: 'nav.watchlist' },
  { view: 'settings', label: 'nav.settings' },
];

/** Slide-over menu for small screens; the desktop header shows the same links inline. */
export function MobileMenu({ open, route, onClose }: { open: boolean; route: Route; onClose: () => void }) {
  const t = useT();
  const theme = useSettings((state) => state.theme);
  const lang = useSettings((state) => state.lang);
  const toggleTheme = useSettings((state) => state.toggleTheme);
  const setLang = useSettings((state) => state.setLang);

  return (
    <Modal open={open} onClose={onClose} labelledBy="menu-title">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h2 id="menu-title" className="text-xs font-semibold uppercase tracking-wide text-muted">
          {t('nav.menu')}
        </h2>
        <button type="button" onClick={onClose} className="btn btn-ghost h-6 px-1.5 text-2xs">
          {t('nav.close')}
        </button>
      </div>
      <ul className="p-1.5">
        {ITEMS.map((item) => {
          const active = route.view === item.view;
          return (
            <li key={item.view}>
              <button
                type="button"
                onClick={() => {
                  navigate({ view: item.view, exchange: null, rawSymbol: null, comparePair: null });
                  onClose();
                }}
                aria-current={active ? 'page' : undefined}
                className={`flex w-full items-center justify-between rounded px-2 py-2 text-xs ${
                  active ? 'bg-raised text-ink' : 'text-muted hover:bg-raised/60'
                }`}
              >
                {t(item.label)}
                <span aria-hidden="true" className="text-[10px]">
                  →
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2 text-[10px] text-muted">
        <div className="flex items-center gap-1">
          <button type="button" onClick={toggleTheme} className="btn h-6 text-2xs">
            {theme === 'dark' ? `☀ ${t('theme.light')}` : `☾ ${t('theme.dark')}`}
          </button>
          <button type="button" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')} className="btn h-6 text-2xs">
            {lang === 'zh' ? 'EN' : '中文'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <a href={AUTHOR_URL} target="_blank" rel="noreferrer noopener" className="hover:text-ink">
            𝕏
          </a>
          <a href={REPO_URL} target="_blank" rel="noreferrer noopener" className="hover:text-ink">
            GitHub
          </a>
          <span className="num">{t('footer.version', { v: APP_VERSION })}</span>
        </div>
      </div>
    </Modal>
  );
}
