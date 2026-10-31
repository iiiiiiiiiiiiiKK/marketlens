import { useT } from '../hooks/useI18n';
import { AUTHOR_URL, APP_VERSION, LICENSE, REPO_URL } from '../lib/constants';
import { navigate } from '../lib/router';

export function Footer() {
  const t = useT();
  return (
    <footer className="mt-3 border-t border-line px-2 py-3 text-[10px] leading-relaxed text-muted">
      <div className="mx-auto flex max-w-[1800px] flex-col gap-1.5">
        <p className="max-w-4xl">{t('footer.disclaimer')}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>
            {t('footer.dataBy')}:{' '}
            <a href="https://www.binance.com" target="_blank" rel="noreferrer noopener" className="text-ink hover:text-accent">
              Binance
            </a>
            {', '}
            <a href="https://www.bybit.com" target="_blank" rel="noreferrer noopener" className="text-ink hover:text-accent">
              Bybit
            </a>
          </span>
          <span>{t('footer.unofficial')}</span>
          <span>
            {t('footer.builtBy')}:{' '}
            <a href={AUTHOR_URL} target="_blank" rel="noreferrer noopener" className="text-ink hover:text-accent">
              𝕏 @0xkillcoin
            </a>
          </span>
          <a href={REPO_URL} target="_blank" rel="noreferrer noopener" className="text-ink hover:text-accent">
            {t('footer.source')}
          </a>
          <span>{LICENSE}</span>
          <button type="button" onClick={() => navigate({ view: 'settings', exchange: null, rawSymbol: null, comparePair: null })} className="hover:text-accent">
            {t('nav.settings')}
          </button>
          <span className="num">{t('footer.version', { v: APP_VERSION })}</span>
        </div>
      </div>
    </footer>
  );
}
