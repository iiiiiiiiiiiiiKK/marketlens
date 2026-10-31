import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CandlestickSeries,
  createChart,
  HistogramSeries,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { useLang, useT } from '../hooks/useI18n';
import { useKlines } from '../hooks/useKlines';
import { useLiveTicker } from '../hooks/useLiveTicker';
import { useSettings } from '../store/settings';
import { formatCompact, formatPrice } from '../lib/format';
import { getAdapter, sourceLabel } from '../data';
import { CHART_INTERVALS } from '../lib/types';
import type { Candle, ChartInterval, ExchangeId } from '../lib/types';
import { Delta, EmptyState, ErrorState, Segmented, Skeleton } from './ui';

interface ChartPanelProps {
  exchange: ExchangeId;
  rawSymbol: string;
  symbol: string;
  /** Last known price from the ticker store, shown until a candle or tick lands. */
  fallbackPrice?: number | null;
  fallbackChange?: number | null;
  heightClass?: string;
  compactHeader?: boolean;
}

const INTERVAL_LABEL: Record<ChartInterval, string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '1h': '1H',
  '4h': '4H',
  '1d': '1D',
  '1w': '1W',
};

export function ChartPanel({
  exchange,
  rawSymbol,
  symbol,
  fallbackPrice = null,
  fallbackChange = null,
  heightClass = 'h-[320px] sm:h-[420px]',
  compactHeader = false,
}: ChartPanelProps) {
  const t = useT();
  const lang = useLang();
  const theme = useSettings((state) => state.theme);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const [interval, setInterval] = useState<ChartInterval>('1h');
  const [hover, setHover] = useState<Candle | null>(null);
  const [chartError, setChartError] = useState(false);

  const { candles, status, error, reload } = useKlines(exchange, rawSymbol, interval);
  const { live, streamStatus } = useLiveTicker(exchange, rawSymbol);

  const adapter = getAdapter(exchange);
  const supported = adapter.intervals;

  const last = candles.length > 0 ? candles[candles.length - 1] : null;
  const currentPrice = live?.price ?? last?.close ?? fallbackPrice ?? null;
  const change = live?.changePercent24h ?? fallbackChange ?? null;
  const legend = hover ?? last;

  // Create the chart once per theme; the series data is fed by a separate effect.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let chart: IChartApi;
    try {
      chart = createChart(container, {
        autoSize: true,
        layout: {
          background: { color: 'transparent' },
          textColor: theme === 'dark' ? '#7d8da3' : '#64748b',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fontSize: 10,
          attributionLogo: false,
        },
        grid: {
          vertLines: { color: theme === 'dark' ? 'rgba(30,37,48,0.7)' : 'rgba(219,227,238,0.8)' },
          horzLines: { color: theme === 'dark' ? 'rgba(30,37,48,0.7)' : 'rgba(219,227,238,0.8)' },
        },
        rightPriceScale: { borderColor: theme === 'dark' ? '#1e2530' : '#dbe3ee', scaleMargins: { top: 0.08, bottom: 0.26 } },
        timeScale: { borderColor: theme === 'dark' ? '#1e2530' : '#dbe3ee', timeVisible: true, secondsVisible: false, rightOffset: 4 },
        crosshair: {
          mode: 0,
          vertLine: { color: theme === 'dark' ? '#3a4657' : '#94a3b8', width: 1, style: 2, labelBackgroundColor: '#5b8cff' },
          horzLine: { color: theme === 'dark' ? '#3a4657' : '#94a3b8', width: 1, style: 2, labelBackgroundColor: '#5b8cff' },
        },
        handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
        handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
        localization: { priceFormatter: (price: number) => formatPrice(price, lang) },
      });
      chartRef.current = chart;
      candleRef.current = chart.addSeries(CandlestickSeries, {
        upColor: '#16c784',
        downColor: '#ea3943',
        borderUpColor: '#16c784',
        borderDownColor: '#ea3943',
        wickUpColor: '#16c784',
        wickDownColor: '#ea3943',
        priceLineVisible: true,
        priceLineStyle: 2,
      });
      volumeRef.current = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
        color: theme === 'dark' ? 'rgba(91,140,255,0.35)' : 'rgba(37,99,235,0.28)',
      });
      chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
      setChartError(false);
    } catch {
      setChartError(true);
      return;
    }

    const onCrosshair = (param: MouseEventParams<Time>) => {
      if (!param.time) {
        setHover(null);
        return;
      }
      const point = param.seriesData.get(candleRef.current!) as CandlestickData<Time> | undefined;
      if (!point) {
        setHover(null);
        return;
      }
      setHover({
        time: Number(param.time),
        open: point.open,
        high: point.high,
        low: point.low,
        close: point.close,
        volume: 0,
      });
    };
    chart.subscribeCrosshairMove(onCrosshair);

    return () => {
      chart.unsubscribeCrosshairMove(onCrosshair);
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
    };
  }, [theme, lang]);

  useEffect(() => {
    if (!candleRef.current || !volumeRef.current) return;
    const bars: CandlestickData<Time>[] = candles.map((candle) => ({
      time: candle.time as UTCTimestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));
    candleRef.current.setData(bars);
    volumeRef.current.setData(
      candles.map((candle) => ({
        time: candle.time as UTCTimestamp,
        value: candle.volume,
        color: candle.close >= candle.open ? 'rgba(22,199,132,0.35)' : 'rgba(234,57,67,0.35)',
      })),
    );
    if (bars.length > 0) chartRef.current?.timeScale().fitContent();
  }, [candles]);

  // Stream the latest trade into the newest candle without a full redraw.
  useEffect(() => {
    if (!candleRef.current || !live || candles.length === 0) return;
    const newest = candles[candles.length - 1];
    candleRef.current.update({
      time: newest.time as UTCTimestamp,
      open: newest.open,
      high: Math.max(newest.high, live.price),
      low: Math.min(newest.low, live.price),
      close: live.price,
    });
  }, [live, candles]);

  const intervalOptions = useMemo(
    () =>
      CHART_INTERVALS.filter((value) => supported.includes(value)).map((value) => ({
        value,
        label: INTERVAL_LABEL[value],
      })),
    [supported],
  );

  const streamTone =
    streamStatus === 'open' ? 'text-up' : streamStatus === 'connecting' || streamStatus === 'reconnecting' ? 'text-amber-500' : 'text-muted';

  return (
    <section className="panel flex min-h-0 flex-col" aria-label={`${symbol} ${t('chart.title')}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line px-2 py-1.5">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="font-mono text-sm font-semibold text-ink">{symbol}</span>
          <span className="rounded bg-raised px-1 text-[9px] font-semibold uppercase tracking-wide text-muted">
            {sourceLabel(exchange, lang)}
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="num text-sm font-semibold text-ink" data-testid="chart-last-price">
            {formatPrice(currentPrice, lang)}
          </span>
          <Delta value={change} />
        </div>

        <span className={`hidden items-center gap-1 text-[10px] sm:flex ${streamTone}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${streamStatus === 'open' ? 'bg-up animate-pulseDot' : 'bg-muted'}`} />
          {streamStatus === 'open' ? t('status.connected') : streamStatus === 'unsupported' ? t('status.disconnected') : t('status.connecting')}
        </span>

        <div className="ml-auto flex items-center gap-1">
          {!compactHeader && (
            <button type="button" onClick={reload} className="btn btn-ghost h-6 w-6 px-0" title={t('common.refreshNow')}>
              ↻
            </button>
          )}
          <Segmented
            options={intervalOptions}
            value={supported.includes(interval) ? interval : supported[0]}
            onChange={setInterval}
            ariaLabel={t('chart.interval')}
          />
        </div>
      </div>

      {legend && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-b border-line/60 px-2 py-1 text-[10px] text-muted">
          <span className="num">
            {t('chart.ohlc', {
              o: formatPrice(legend.open, lang),
              h: formatPrice(legend.high, lang),
              l: formatPrice(legend.low, lang),
              c: formatPrice(legend.close, lang),
            })}
          </span>
          {legend.volume > 0 && (
            <span className="num">
              {t('chart.volume')} {formatCompact(legend.volume, lang)}
            </span>
          )}
        </div>
      )}

      <div className={`relative ${heightClass}`}>
        <div ref={containerRef} className="absolute inset-0" data-testid="chart-canvas" />

        {chartError && <EmptyState message={t('chart.empty')} />}

        {!chartError && status === 'loading' && candles.length === 0 && (
          <div className="absolute inset-0 flex flex-col justify-end gap-1 p-3">
            <Skeleton className="h-[60%] w-full" />
            <div className="flex gap-1">
              <Skeleton className="h-6 w-1/6" />
              <Skeleton className="h-10 w-1/6" />
              <Skeleton className="h-8 w-1/6" />
              <Skeleton className="h-12 w-1/6" />
              <Skeleton className="h-5 w-1/6" />
            </div>
            <p className="text-center text-2xs text-muted">{t('chart.loading')}</p>
          </div>
        )}

        {!chartError && status === 'error' && (
          <div className="absolute inset-0 bg-panel/85">
            <ErrorState reason={error} exchange={sourceLabel(exchange, lang)} onRetry={reload} />
          </div>
        )}

        {!chartError && status === 'ready' && candles.length === 0 && (
          <div className="absolute inset-0 bg-panel/85">
            <EmptyState message={t('chart.empty')} hint={t('chart.sourceNote', { exchange: sourceLabel(exchange, lang) })} />
          </div>
        )}
      </div>

      <p className="border-t border-line px-2 py-1 text-[10px] text-muted">
        {t('chart.sourceNote', { exchange: sourceLabel(exchange, lang) })}
      </p>
    </section>
  );
}
