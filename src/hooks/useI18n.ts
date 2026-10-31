import { useCallback } from 'react';
import { translate } from '../lib/i18n';
import type { Lang, MessageKey } from '../lib/i18n';
import { useSettings } from '../store/settings';

/** Returns a translator bound to the active language. */
export function useT() {
  const lang = useSettings((state) => state.lang);
  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang],
  );
  return t;
}

export function useLang(): Lang {
  return useSettings((state) => state.lang);
}
