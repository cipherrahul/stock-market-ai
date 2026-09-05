'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  ColorType,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  CrosshairMode,
  MouseEventParams,
} from 'lightweight-charts';
import { useTheme } from '@/contexts/ThemeContext';
import { FiMaximize2, FiActivity, FiRefreshCw } from 'react-icons/fi';
import { ChartTimeframe } from '@/hooks/useCandlestickData';

interface SovereignChartProps {
  data: CandlestickData[];
  latestCandle?: CandlestickData | null;
  symbol?: string;
  timeframe?: ChartTimeframe;
  onTimeframeChange?: (tf: ChartTimeframe) => void;
  height?: number;
  loading?: boolean;
}

export const SovereignChart: React.FC<SovereignChartProps> = ({
  data,
  latestCandle,
  symbol = 'RELIANCE',
  timeframe = '5m',
  onTimeframeChange,
  height = 440,
  loading = false,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  const { isDracula } = useTheme();

  // Active hover/crosshair candle for HUD
  const [hoveredCandle, setHoveredCandle] = useState<CandlestickData | null>(null);

  // Fallback to latest candle or last bar in data
  const displayCandle = hoveredCandle || latestCandle || (data.length > 0 ? data[data.length - 1] : null);

  // Calculate bar change
  const barChange = displayCandle ? displayCandle.close - displayCandle.open : 0;
  const barChangePct = displayCandle && displayCandle.open > 0 ? (barChange / displayCandle.open) * 100 : 0;
  const isUp = barChange >= 0;

  // ── Theme Palettes ────────────────────────────────────────────────────────────
  const themeColors = isDracula
    ? {
        bg: '#191a21',
        grid: 'rgba(98, 114, 164, 0.12)',
        text: '#94a3b8',
        border: '#282a36',
        up: '#50fa7b',
        down: '#ff5555',
        crosshair: 'rgba(189, 147, 249, 0.4)',
      }
    : {
        bg: '#ffffff',
        grid: 'rgba(226, 232, 240, 0.8)',
        text: '#64748b',
        border: '#e2e8f0',
        up: '#10b981',
        down: '#ef4444',
        crosshair: 'rgba(59, 130, 246, 0.4)',
      };

  // ── Initialize Chart Once ───────────────────────────────────────────────────
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: themeColors.bg },
        textColor: themeColors.text,
        fontFamily: "'JetBrains Mono', 'Fira Code', var(--font-display), monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: themeColors.grid },
        horzLines: { color: themeColors.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: themeColors.crosshair,
          width: 1,
          style: 3, // dashed
          labelBackgroundColor: isDracula ? '#44475a' : '#1e293b',
        },
        horzLine: {
          color: themeColors.crosshair,
          width: 1,
          style: 3,
          labelBackgroundColor: isDracula ? '#44475a' : '#1e293b',
        },
      },
      timeScale: {
        borderColor: themeColors.border,
        timeVisible: true,
        secondsVisible: timeframe === '1m',
        barSpacing: 10,
        minBarSpacing: 4,
      },
      rightPriceScale: {
        borderColor: themeColors.border,
        scaleMargins: {
          top: 0.12,
          bottom: 0.12,
        },
        autoScale: true,
      },
      handleScroll: true,
      handleScale: true,
      width: chartContainerRef.current.clientWidth,
      height,
    });

    const series = chart.addCandlestickSeries({
      upColor: themeColors.up,
      downColor: themeColors.down,
      borderVisible: true,
      borderColor: isDracula ? '#282a36' : '#ffffff',
      borderUpColor: themeColors.up,
      borderDownColor: themeColors.down,
      wickUpColor: themeColors.up,
      wickDownColor: themeColors.down,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    // Crosshair listener for live HUD updates
    chart.subscribeCrosshairMove((param: MouseEventParams) => {
      if (param.time && param.seriesData.size > 0) {
        const seriesData = param.seriesData.get(series) as CandlestickData;
        if (seriesData) {
          setHoveredCandle(seriesData);
          return;
        }
      }
      setHoveredCandle(null);
    });

    // ResizeObserver for responsiveness
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0 || !entries[0].contentRect) return;
      const { width } = entries[0].contentRect;
      chart.applyOptions({ width });
    });

    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [isDracula, height]); // Only reinitialize when theme or container height changes!

  // ── Feed Initial or Changed Full Dataset ─────────────────────────────────────
  useEffect(() => {
    if (seriesRef.current && data && data.length > 0) {
      try {
        seriesRef.current.setData(data);
        if (chartRef.current) {
          chartRef.current.timeScale().fitContent();
        }
      } catch (err) {
        console.warn('[SovereignChart] Error setting series data:', err);
      }
    }
  }, [data]);

  // ── Real-time Single Candle Updates ──────────────────────────────────────────
  useEffect(() => {
    if (seriesRef.current && latestCandle) {
      try {
        seriesRef.current.update(latestCandle);
      } catch (err) {
        console.warn('[SovereignChart] Error updating tick candle:', err);
      }
    }
  }, [latestCandle]);

  const handleFitContent = useCallback(() => {
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, []);

  const timeframes: ChartTimeframe[] = ['1m', '5m', '15m', '1h', '1d'];

  return (
    <div
      className={`relative w-full rounded-2xl border transition-all duration-300 overflow-hidden shadow-xl ${
        isDracula
          ? 'bg-[#191a21] border-[#282a36] text-[#f8f8f2]'
          : 'bg-white border-slate-200 text-slate-900'
      }`}
    >
      {/* ── Chart Top HUD ── */}
      <div
        className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-3 text-xs ${
          isDracula ? 'border-[#282a36] bg-[#21222c]/80' : 'border-slate-100 bg-slate-50/70'
        }`}
      >
        {/* Left: Symbol, Live Status, Timeframe */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm tracking-wider font-mono uppercase">
              {symbol}
            </span>
            <span
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                isDracula
                  ? 'bg-emerald-500/10 text-[#50fa7b] border border-emerald-500/20'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE TICK
            </span>
          </div>

          {/* Timeframe Chips */}
          <div
            className={`flex items-center rounded-lg p-0.5 border ${
              isDracula ? 'bg-[#282a36] border-[#44475a]' : 'bg-white border-slate-200 shadow-xs'
            }`}
          >
            {timeframes.map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => onTimeframeChange && onTimeframeChange(tf)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider transition-all ${
                  timeframe === tf
                    ? isDracula
                      ? 'bg-[#bd93f9] text-[#282a36]'
                      : 'bg-blue-600 text-white'
                    : isDracula
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {loading && (
            <span className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
              <FiRefreshCw className="animate-spin text-blue-500" size={11} />
              Hydrating…
            </span>
          )}
          <button
            type="button"
            onClick={handleFitContent}
            title="Reset Zoom / Fit Content"
            className={`p-1.5 rounded-lg border transition-all ${
              isDracula
                ? 'border-[#44475a] bg-[#282a36] text-slate-300 hover:text-white hover:border-[#bd93f9]'
                : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FiMaximize2 size={12} />
          </button>
        </div>
      </div>

      {/* ── Real-time OHLC Metric Bar ── */}
      {displayCandle && (
        <div
          className={`px-4 py-2 border-b flex flex-wrap items-center gap-4 text-[11px] font-mono select-none ${
            isDracula ? 'border-[#282a36]/60 bg-[#1e1f29]/90' : 'border-slate-100 bg-white'
          }`}
        >
          <div className="flex items-center gap-1">
            <span className="text-slate-400">O:</span>
            <span className="font-bold">₹{displayCandle.open.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-400">H:</span>
            <span className="font-bold text-emerald-600">₹{displayCandle.high.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-400">L:</span>
            <span className="font-bold text-rose-600">₹{displayCandle.low.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-400">C:</span>
            <span className={`font-bold ${isUp ? 'text-emerald-500' : 'text-rose-500'}`}>
              ₹{displayCandle.close.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-400">Chg:</span>
            <span className={`font-bold ${isUp ? 'text-emerald-500' : 'text-rose-500'}`}>
              {isUp ? '+' : ''}₹{barChange.toFixed(2)} ({isUp ? '+' : ''}
              {barChangePct.toFixed(2)}%)
            </span>
          </div>
          <div className="ml-auto text-[10px] text-slate-400 hidden sm:block">
            {new Date((displayCandle.time as number) * 1000).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: timeframe === '1m' ? '2-digit' : undefined,
            })}
          </div>
        </div>
      )}

      {/* ── Lightweight Charts Container ── */}
      <div className="relative w-full" style={{ height: `${height}px` }}>
        <div ref={chartContainerRef} className="w-full h-full" />
        {data.length === 0 && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/10 backdrop-blur-xs">
            <FiActivity className="text-slate-400 animate-pulse mb-2" size={24} />
            <p className="text-xs font-bold text-slate-400">Awaiting market ticks for {symbol}…</p>
          </div>
        )}
      </div>
    </div>
  );
};
