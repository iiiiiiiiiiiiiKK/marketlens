import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { translate } from '../lib/i18n';
import type { Lang } from '../lib/i18n';

interface Props {
  children: ReactNode;
  lang: Lang;
  /** Optional label shown in the fallback so the failing panel is identifiable. */
  label?: string;
}

interface State {
  error: Error | null;
}

/**
 * Isolates render failures so one broken panel cannot blank the whole dashboard.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[MarketLens] panel error', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    const { lang, children, label } = this.props;
    if (!error) return children;
    return (
      <div className="panel flex flex-col items-center gap-2 p-6 text-center" role="alert">
        <span aria-hidden="true" className="text-lg text-down">
          ⚠
        </span>
        <p className="text-xs font-semibold text-ink">
          {translate(lang, 'error.boundary.title')}
          {label ? ` — ${label}` : ''}
        </p>
        <p className="max-w-sm text-2xs leading-relaxed text-muted">{translate(lang, 'error.boundary.body')}</p>
        <button type="button" className="btn btn-accent mt-1" onClick={() => this.setState({ error: null })}>
          {translate(lang, 'common.retry')}
        </button>
      </div>
    );
  }
}
