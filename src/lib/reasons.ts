import type { MessageKey } from './i18n';

/** Maps transport-level failure codes to user-facing translation keys. */
const REASONS: Record<string, MessageKey> = {
  timeout: 'error.api.reason.timeout',
  network: 'error.api.reason.network',
  'bad-payload': 'error.api.reason.bad-payload',
  'http-429': 'error.api.reason.http-429',
  'http-418': 'error.api.reason.http-418',
  'http-451': 'error.api.reason.http-451',
  http: 'error.api.reason.http',
  aborted: 'error.api.reason.aborted',
  unknown: 'error.api.reason.unknown',
};

export function reasonMessageKey(reason: string | null): MessageKey {
  if (!reason) return 'error.api.reason.unknown';
  return REASONS[reason] ?? (reason.startsWith('http-') ? 'error.api.reason.http' : 'error.api.reason.unknown');
}
