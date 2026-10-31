import { beforeEach, describe, expect, it } from 'vitest';
import {
  WATCHLIST_STORAGE_KEY,
  defaultGroup,
  isWatched,
  loadWatchlist,
  persistWatchlist,
  useWatchlist,
  watchedIds,
} from './watchlist';
import { SETTINGS_STORAGE_KEY, loadPersistedSettings, persistSettings, useSettings } from './settings';

beforeEach(() => {
  useWatchlist.setState({ groups: [defaultGroup()], activeGroupId: 'default', recent: [] });
});

describe('watchlist store', () => {
  it('adds, de-duplicates and removes markets', () => {
    const store = useWatchlist.getState();
    store.add('binance-spot:BTCUSDT');
    store.add('binance-spot:BTCUSDT');
    expect(watchedIds(useWatchlist.getState().groups, 'default')).toEqual(['binance-spot:BTCUSDT']);

    store.remove('binance-spot:BTCUSDT');
    expect(watchedIds(useWatchlist.getState().groups, 'default')).toEqual([]);
  });

  it('toggles membership', () => {
    const store = useWatchlist.getState();
    store.toggle('bybit-spot:ETHUSDT');
    expect(isWatched(useWatchlist.getState().groups, 'bybit-spot:ETHUSDT')).toBe(true);
    store.toggle('bybit-spot:ETHUSDT');
    expect(isWatched(useWatchlist.getState().groups, 'bybit-spot:ETHUSDT')).toBe(false);
  });

  it('reorders items and ignores out-of-range moves', () => {
    const store = useWatchlist.getState();
    store.add('a');
    store.add('b');
    store.add('c');
    store.move('c', -1);
    expect(watchedIds(useWatchlist.getState().groups, 'default')).toEqual(['a', 'c', 'b']);
    store.move('a', -1);
    expect(watchedIds(useWatchlist.getState().groups, 'default')).toEqual(['a', 'c', 'b']);
  });

  it('manages groups', () => {
    const store = useWatchlist.getState();
    const groupId = store.createGroup('Scalping');
    expect(useWatchlist.getState().activeGroupId).toBe(groupId);
    store.add('binance-futures:BTCUSDT');
    expect(watchedIds(useWatchlist.getState().groups, groupId)).toEqual(['binance-futures:BTCUSDT']);

    store.renameGroup(groupId, 'Perps');
    expect(useWatchlist.getState().groups.find((group) => group.id === groupId)?.name).toBe('Perps');

    store.deleteGroup(groupId);
    expect(useWatchlist.getState().groups).toHaveLength(1);
    expect(useWatchlist.getState().activeGroupId).toBe('default');
  });

  it('never deletes the last group', () => {
    useWatchlist.getState().deleteGroup('default');
    expect(useWatchlist.getState().groups).toHaveLength(1);
  });

  it('keeps a bounded recent list without duplicates', () => {
    const store = useWatchlist.getState();
    for (let index = 0; index < 12; index += 1) store.pushRecent(`id-${index}`);
    store.pushRecent('id-5');
    const recent = useWatchlist.getState().recent;
    expect(recent).toHaveLength(8);
    expect(recent[0]).toBe('id-5');
  });

  it('round-trips through localStorage', () => {
    const store = useWatchlist.getState();
    const groupId = store.createGroup('Alpha');
    store.add('binance-spot:SOLUSDT');
    persistWatchlist(useWatchlist.getState());
    expect(localStorage.getItem(WATCHLIST_STORAGE_KEY)).toBeTruthy();

    useWatchlist.setState({ groups: [defaultGroup()], activeGroupId: 'default', recent: [] });
    loadWatchlist();
    const restored = useWatchlist.getState();
    expect(restored.activeGroupId).toBe(groupId);
    expect(watchedIds(restored.groups, groupId)).toEqual(['binance-spot:SOLUSDT']);
  });

  it('survives corrupted storage', () => {
    localStorage.setItem(WATCHLIST_STORAGE_KEY, '{{{not json');
    expect(() => loadWatchlist()).not.toThrow();
    expect(useWatchlist.getState().groups).toHaveLength(1);
  });
});

describe('settings store', () => {
  it('applies and persists theme + language', () => {
    const store = useSettings.getState();
    store.setTheme('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    store.setLang('zh');
    expect(document.documentElement.lang).toBe('zh-CN');

    persistSettings(useSettings.getState());
    const raw = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) as string);
    expect(raw.state.theme).toBe('light');
    expect(raw.state.lang).toBe('zh');
  });

  it('toggles the theme both ways', () => {
    const store = useSettings.getState();
    store.setTheme('dark');
    store.toggleTheme();
    expect(useSettings.getState().theme).toBe('light');
    store.toggleTheme();
    expect(useSettings.getState().theme).toBe('dark');
  });

  it('reloads persisted values', () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ state: { theme: 'light', lang: 'en', refreshIntervalMs: 30_000 } }),
    );
    loadPersistedSettings();
    expect(useSettings.getState().theme).toBe('light');
    expect(useSettings.getState().refreshIntervalMs).toBe(30_000);
  });

  it('ignores broken persisted settings', () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, 'not-json');
    expect(() => loadPersistedSettings()).not.toThrow();
  });
});
