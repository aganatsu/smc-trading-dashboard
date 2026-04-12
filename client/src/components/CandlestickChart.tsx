/**
 * CandlestickChart — Interactive chart with SMC overlays
 * Design: Obsidian Forge — Dark Brutalist Trading Interface
 * Uses lightweight-charts v5 API
 */

import { useEffect, useRef, useMemo } from 'react';
// @ts-ignore - v5 exports
import { createChart, ColorType, CrosshairMode, CandlestickSeries, createSeriesMarkers } from 'lightweight-charts';
import type { IChartApi, CandlestickData, Time } from 'lightweight-charts';
import type { Candle, AnalysisResult } from '@/lib/smcAnalysis';
import type { Instrument } from '@/lib/marketData';

interface Props {
  candles: Candle[];
  analysis: AnalysisResult | null;
  instrument: Instrument;
  loading: boolean;
}

export default function CandlestickChart({ candles, analysis, instrument, loading }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<any>(null);

  const chartData: CandlestickData[] = useMemo(() => {
    return candles.map(c => ({
      time: c.datetime.split(' ')[0] as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
  }, [candles]);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0A0A0F' },
        textColor: '#6B7280',
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)' },
        horzLines: { color: 'rgba(255,255,255,0.03)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(0,229,255,0.3)', width: 1, style: 2 },
        horzLine: { color: 'rgba(0,229,255,0.3)', width: 1, style: 2 },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.1)',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: true,
      handleScale: true,
    });

    chartRef.current = chart;

    // v5 API: use addSeries with candlestickSeries definition
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#00E5FF',
      downColor: '#E84855',
      borderUpColor: '#00E5FF',
      borderDownColor: '#E84855',
      wickUpColor: '#00E5FF',
      wickDownColor: '#E84855',
    });

    candleSeriesRef.current = series;

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        chart.applyOptions({ width, height });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
    };
  }, []);

  // Update data
  useEffect(() => {
    if (!candleSeriesRef.current || chartData.length === 0) return;

    // Deduplicate by time
    const seen = new Set<string>();
    const uniqueData = chartData.filter(d => {
      const key = String(d.time);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    candleSeriesRef.current.setData(uniqueData);

    // Add price lines for analysis overlays
    if (analysis && chartRef.current) {
      // 50% level
      try {
        candleSeriesRef.current.createPriceLine({
          price: analysis.fiftyPercentLevel,
          color: '#FFB800',
          lineWidth: 2,
          lineStyle: 2,
          axisLabelVisible: true,
          title: '50%',
        });
      } catch {}

      // Fibonacci levels
      analysis.fibLevels.forEach(fib => {
        try {
          const isFifty = fib.label === '50%';
          const isKey = fib.label === '61.8%' || fib.label === '38.2%';
          candleSeriesRef.current?.createPriceLine({
            price: fib.price,
            color: isFifty ? '#FFB800' : isKey ? 'rgba(0,229,255,0.5)' : 'rgba(0,229,255,0.2)',
            lineWidth: isFifty ? 2 : 1,
            lineStyle: isFifty ? 0 : 2,
            axisLabelVisible: isFifty || isKey,
            title: fib.label,
          });
        } catch {}
      });

      // Support levels
      analysis.keySupport.slice(0, 3).forEach(level => {
        try {
          candleSeriesRef.current?.createPriceLine({
            price: level,
            color: 'rgba(0,229,255,0.4)',
            lineWidth: 1,
            lineStyle: 1,
            axisLabelVisible: true,
            title: 'S',
          });
        } catch {}
      });

      // Resistance levels
      analysis.keyResistance.slice(0, 3).forEach(level => {
        try {
          candleSeriesRef.current?.createPriceLine({
            price: level,
            color: 'rgba(232,72,85,0.4)',
            lineWidth: 1,
            lineStyle: 1,
            axisLabelVisible: true,
            title: 'R',
          });
        } catch {}
      });

      // Swing point markers via v5 setMarkers
      const markers = analysis.structure.swingPoints
        .filter(sp => sp.index < uniqueData.length)
        .map(sp => ({
          time: uniqueData[Math.min(sp.index, uniqueData.length - 1)]?.time,
          position: sp.type === 'high' ? 'aboveBar' as const : 'belowBar' as const,
          color: sp.type === 'high' ? '#E84855' : '#00E5FF',
          shape: sp.type === 'high' ? 'arrowDown' as const : 'arrowUp' as const,
          text: sp.type === 'high' ? 'HH' : 'HL',
        }))
        .filter(m => m.time);

      if (markers.length > 0) {
        try {
          createSeriesMarkers(candleSeriesRef.current, markers);
        } catch {}
      }
    }

    chartRef.current?.timeScale().fitContent();
  }, [chartData, analysis]);

  return (
    <div className="relative w-full h-full bg-[#0A0A0F]">
      <div ref={containerRef} className="w-full h-full" />
      
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-8 bg-cyan animate-pulse" />
            <div className="w-1.5 h-8 bg-cyan animate-pulse" style={{ animationDelay: '0.15s' }} />
            <div className="w-1.5 h-8 bg-cyan animate-pulse" style={{ animationDelay: '0.3s' }} />
            <span className="text-xs font-mono text-muted-foreground ml-3 uppercase tracking-wider">Loading</span>
          </div>
        </div>
      )}

      {/* Chart legend */}
      <div className="absolute top-3 left-3 flex items-center gap-4 text-[10px] font-mono text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-[#FFB800] inline-block" />
          50% LEVEL
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-cyan/50 inline-block" />
          FIB LEVELS
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-cyan/40 inline-block" />
          SUPPORT
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-bearish/40 inline-block" />
          RESISTANCE
        </span>
      </div>
    </div>
  );
}
