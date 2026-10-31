import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { formatPercent } from '../lib/format';
import { useT } from '../hooks/useI18n';
import { reasonMessageKey } from '../lib/reasons';

/* ------------------------------------------------------------------ skeleton */

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-1.5 p-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="ml-auto h-3 w-14" />
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- status bits */

export function Pill({
  tone = 'neutral',
  children,
  title,
}: {
  tone?: 'neutral' | 'up' | 'down' | 'warn' | 'accent';
  children: ReactNode;
  title?: string;
}) {
  const tones: Record<string, string> = {
    neutral: 'border-line text-muted',
    up: 'border-up/40 text-up bg-up/10',
    down: 'border-down/40 text-down bg-down/10',
    warn: 'border-amber-500/40 text-amber-500 bg-amber-500/10',
    accent: 'border-accent/40 text-accent bg-accent/10',
  };
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-[1px] text-2xs font-semibold uppercase tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function LiveDot({ tone = 'up' }: { tone?: 'up' | 'warn' | 'down' | 'muted' }) {
  const colors: Record<string, string> = {
    up: 'bg-up',
    warn: 'bg-amber-500',
    down: 'bg-down',
    muted: 'bg-muted',
  };
  return <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${colors[tone]} animate-pulseDot`} aria-hidden="true" />;
}

/* ---------------------------------------------------------------------- delta */

/**
 * Percentage change. Never relies on colour alone: the sign and an arrow glyph
 * are always rendered, so the value is readable in greyscale.
 */
export function Delta({
  value,
  digits = 2,
  className = '',
  showArrow = true,
}: {
  value: number | null | undefined;
  digits?: number;
  className?: string;
  showArrow?: boolean;
}) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return <span className={`num text-muted ${className}`}>—</span>;
  }
  const tone = value > 0 ? 'text-up' : value < 0 ? 'text-down' : 'text-muted';
  const arrow = value > 0 ? '▲' : value < 0 ? '▼' : '–';
  return (
    <span className={`num ${tone} ${className}`}>
      {showArrow && <span className="mr-0.5 text-[0.75em]">{arrow}</span>}
      {formatPercent(value, digits)}
    </span>
  );
}

/** Highlights a price cell when the value changes between renders. */
export function PriceFlash({ value, className = '' }: { value: number | string; className?: string }) {
  const previous = useRef(value);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (previous.current !== value) {
      const numericPrevious = Number(previous.current);
      const numericNext = Number(value);
      if (Number.isFinite(numericPrevious) && Number.isFinite(numericNext)) {
        setFlash(numericNext > numericPrevious ? 'up' : 'down');
        const timer = setTimeout(() => setFlash(null), 700);
        previous.current = value;
        return () => clearTimeout(timer);
      }
      previous.current = value;
    }
    return undefined;
  }, [value]);

  const animation = flash === 'up' ? 'animate-flashUp' : flash === 'down' ? 'animate-flashDown' : '';
  return <span className={`rounded px-1 ${animation} ${className}`}>{value}</span>;
}

/* ------------------------------------------------------------------ controls */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = '',
}: {
  options: Array<{ value: T; label: ReactNode; title?: string }>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-0.5 rounded border border-line bg-raised/70 p-0.5 ${className}`}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={`rounded px-2 py-0.5 text-2xs font-semibold transition-colors ${
              active ? 'bg-panel text-ink shadow-sm' : 'text-muted hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function StarButton({
  active,
  onToggle,
  className = '',
  size = 'sm',
}: {
  active: boolean;
  onToggle: () => void;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      aria-pressed={active}
      aria-label={active ? t('common.unstar') : t('common.star')}
      title={active ? t('common.unstar') : t('common.star')}
      className={`shrink-0 leading-none transition-colors ${
        size === 'md' ? 'text-base' : 'text-xs'
      } ${active ? 'text-amber-400' : 'text-muted/60 hover:text-amber-400'} ${className}`}
    >
      {active ? '★' : '☆'}
    </button>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0">
        <label htmlFor={id} className="text-xs font-medium text-ink">
          {label}
        </label>
        {hint && <p className="mt-0.5 text-2xs leading-relaxed text-muted">{hint}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors ${
          checked ? 'border-accent/60 bg-accent/40' : 'border-line bg-raised'
        }`}
      >
        <span
          className={`absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all ${
            checked ? 'left-[18px] bg-accent' : 'left-0.5 bg-muted'
          }`}
        />
      </button>
    </div>
  );
}

/* --------------------------------------------------------------------- modal */

export function Modal({
  open,
  onClose,
  children,
  labelledBy,
  className = '',
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-3 pt-[8vh] backdrop-blur-sm">
      <div
        className="absolute inset-0"
        aria-hidden="true"
        onClick={onClose}
        style={{ cursor: 'default' }}
      />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`relative z-10 w-full max-w-2xl overflow-hidden rounded-lg border border-line bg-panel shadow-2xl ${className}`}
      >
        {children}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- error states */

export function ErrorState({
  reason,
  exchange,
  onRetry,
  compact = false,
}: {
  reason: string | null;
  exchange?: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  const t = useT();
  const detail = t(reasonMessageKey(reason));
  return (
    <div className={`flex flex-col items-center justify-center gap-2 text-center ${compact ? 'p-4' : 'p-8'}`}>
      <span className="text-lg text-down" aria-hidden="true">
        ⚠
      </span>
      <p className="text-xs font-semibold text-ink">
        {t('error.api.title')}
        {exchange ? ` — ${exchange}` : ''}
      </p>
      <p className="max-w-xs text-2xs leading-relaxed text-muted">{exchange ? t('error.api.body', { exchange, reason: detail }) : detail}</p>
      {onRetry && (
        <button type="button" className="btn btn-accent mt-1" onClick={onRetry}>
          {t('common.retry')}
        </button>
      )}
    </div>
  );
}

export function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 p-8 text-center">
      <p className="text-xs font-medium text-ink">{message}</p>
      {hint && <p className="max-w-sm text-2xs leading-relaxed text-muted">{hint}</p>}
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block h-3 w-3 animate-spin rounded-full border border-current border-t-transparent ${className}`}
      aria-hidden="true"
    />
  );
}
