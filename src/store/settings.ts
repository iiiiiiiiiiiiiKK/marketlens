import { create } from 'zustand';

export type Theme = 'dark' | 'light';
export type Lang = 'zh' | 'en';

export const REFRESH_OPTIONS = [5_000, 10_000, 15_000, 30_000, 60_000] as const;

export interface SettingsState {
  theme: Theme;
  lang: Lang;
  refreshIntervalMs: number;
  paused: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setLang: (lang: Lang) => void;
  setRefreshInterval: (ms: number) => void;
  setPaused: (paused: boolean) => void;
}

function initialTheme(): Theme {
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) return 'dark';
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('light')) return 'light';
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light';
  return 'dark';
}

function initialLang(): Lang {
  if (typeof document !== 'undefined' && document.documentElement.lang.startsWith('zh')) return 'zh';
  if (typeof navigator !== 'undefined' && (navigator.language ?? '').toLowerCase().startsWith('zh')) return 'zh';
  return 'en';
}

export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.classList.toggle('light', theme === 'light');
}

export function applyLang(lang: Lang) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
}

export const useSettings = create<SettingsState>()((set, get) => ({
  theme: initialTheme(),
  lang: initialLang(),
  refreshIntervalMs: 10_000,
  paused: false,
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    set({ theme: next });
  },
  setLang: (lang) => {
    applyLang(lang);
    set({ lang });
  },
  setRefreshInterval: (ms) => set({ refreshIntervalMs: ms }),
  setPaused: (paused) => set({ paused }),
}));

/** Persists the user's display preferences across reloads. */
export const SETTINGS_STORAGE_KEY = 'marketlens.settings.v1';

export function loadPersistedSettings(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return;
    const parsedRaw = JSON.parse(raw) as {
      state?: Partial<Pick<SettingsState, 'theme' | 'lang' | 'refreshIntervalMs'>>;
    } & Partial<Pick<SettingsState, 'theme' | 'lang' | 'refreshIntervalMs'>>;
    // Stored either wrapped ({ state: {...} }) or flat, depending on the writer.
    const parsed = parsedRaw.state ?? parsedRaw;
    if (parsed.theme === 'dark' || parsed.theme === 'light') {
      applyTheme(parsed.theme);
      useSettings.setState({ theme: parsed.theme });
    }
    if (parsed.lang === 'zh' || parsed.lang === 'en') {
      applyLang(parsed.lang);
      useSettings.setState({ lang: parsed.lang });
    }
    if (typeof parsed.refreshIntervalMs === 'number' && parsed.refreshIntervalMs >= 5_000) {
      useSettings.setState({ refreshIntervalMs: parsed.refreshIntervalMs });
    }
  } catch {
    /* corrupted storage — fall back to defaults */
  }
}

export function persistSettings(state: Pick<SettingsState, 'theme' | 'lang' | 'refreshIntervalMs'>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ state: { theme: state.theme, lang: state.lang, refreshIntervalMs: state.refreshIntervalMs } }),
    );
  } catch {
    /* storage full or blocked */
  }
}
