import { useCallback, useEffect, useState } from 'react';
import { TopNav } from './components/TopNav';
import { MobileTabBar } from './components/MobileTabBar';
import { MobileMenu } from './components/MobileMenu';
import { SearchPalette } from './components/SearchPalette';
import { Footer } from './components/Footer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useRoute } from './lib/router';
import { TableView } from './views/TableView';
import { PairView } from './views/PairView';
import { CompareView } from './views/CompareView';
import { WatchlistView } from './views/WatchlistView';
import { SettingsView } from './views/SettingsView';
import { useSettings, persistSettings } from './store/settings';
import { persistWatchlist, useWatchlist } from './store/watchlist';
import { reschedulePolling, startPolling, stopPolling } from './data/controller';
import { closeAllStreams } from './data/liveTicker';
import { useT } from './hooks/useI18n';
import { Pill } from './components/ui';

function OfflineBanner() {
  const t = useT();
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [recovered, setRecovered] = useState(false);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      setRecovered(true);
      const timer = setTimeout(() => setRecovered(false), 4000);
      return () => clearTimeout(timer);
    };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (online && !recovered) return null;

  return (
    <div
      role="status"
      className={`flex flex-wrap items-center gap-2 border-b px-3 py-1 text-2xs ${
        online ? 'border-up/40 bg-up/10 text-up' : 'border-down/40 bg-down/10 text-down'
      }`}
    >
      <Pill tone={online ? 'up' : 'down'}>{online ? t('error.recovered') : t('error.offline.title')}</Pill>
      <span>{online ? '' : t('error.offline.body')}</span>
    </div>
  );
}

export function App() {
  const route = useRoute();
  const lang = useSettings((state) => state.lang);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Persist preferences and watchlists, and keep the polling loop in sync.
  useEffect(() => {
    const unsubscribeSettings = useSettings.subscribe((state) => persistSettings(state));
    const unsubscribeWatchlist = useWatchlist.subscribe((state) => persistWatchlist(state));
    return () => {
      unsubscribeSettings();
      unsubscribeWatchlist();
    };
  }, []);

  useEffect(() => {
    startPolling();
    const unsubscribe = useSettings.subscribe((state, previous) => {
      if (state.refreshIntervalMs !== previous.refreshIntervalMs) reschedulePolling();
    });
    return () => {
      unsubscribe();
      stopPolling();
      closeAllStreams();
    };
  }, []);

  // "/" opens the search palette, matching Bloomberg-style terminals.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;
      if (typing) return;
      if (event.key === '/' || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')) {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const openSearch = useCallback(() => setSearchOpen(true), []);

  const content = (() => {
    switch (route.view) {
      case 'pair':
        return route.exchange && route.rawSymbol ? (
          <PairView exchange={route.exchange} rawSymbol={route.rawSymbol} />
        ) : (
          <TableView kind={null} />
        );
      case 'spot':
        return <TableView kind="spot" />;
      case 'futures':
        return <TableView kind="futures" />;
      case 'compare':
        return <CompareView initialPair={route.comparePair} />;
      case 'watchlist':
        return <WatchlistView />;
      case 'settings':
        return <SettingsView />;
      case 'markets':
      default:
        return <TableView kind={null} />;
    }
  })();

  return (
    <div className="flex min-h-full flex-col bg-base">
      <TopNav route={route} onOpenSearch={openSearch} onOpenMenu={() => setMenuOpen(true)} />
      <OfflineBanner />

      <main className="mx-auto w-full max-w-[1800px] flex-1 px-2 pb-14 pt-2 sm:px-3 md:pb-3">
        <ErrorBoundary key={`${route.view}-${route.exchange ?? ''}-${route.rawSymbol ?? ''}`} lang={lang}>
          {content}
        </ErrorBoundary>
        <Footer />
      </main>

      <MobileTabBar route={route} />
      <MobileMenu open={menuOpen} route={route} onClose={() => setMenuOpen(false)} />
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
