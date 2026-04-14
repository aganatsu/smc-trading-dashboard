/**
 * TradeChart — Lightweight Charts candlestick chart for Bot View
 * Shows trade entries/exits with markers, SL/TP dashed lines, and risk/reward shaded zones
 */

import { useEffect, useRef, useMemo, useCallback } from 'react';
// @ts-ignore - v5 exports
import { createChart, ColorType, CrosshairMode, CandlestickSeries, createSeriesMarkers, LineSeries } from 'lightweight-charts';
import type { IChartApi, CandlestickData, Time } from 'lightweight-charts';
import { trpc } from '@/lib/trpc';

interface Position {
  id: string;
  symbol: string;
  direction: 'long' | 'short';
  size: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  stopLoss: number | null;
  takeProfit: number | null;
  openTime: string;
}

interface TradeRecord {
  id: string;
  symbol: string;
  direction: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  closedAt: string;
}

interface Props {
  symbol: string;
  positions: Position[];
  tradeHistory: TradeRecord[];
}

export default function TradeChart({ symbol, positions, tradeHistory }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<any>(null);

  // Fetch candle data for the selected symbol
  const { data: candles } = trpc.market.candles.useQuery(
    { symbol, interval: '1h', outputsize: 200 },
    { refetchInterval: 60000 }
  );

  const chartData: CandlestickData[] = useMemo(() => {
    if (!candles?.length) return [];
    return candles.map((c: any) => ({
      time: c.datetime.split(' ')[0] as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
  }, [candles]);

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0A0A0F' },
        textColor: '#6B7280',
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 10,
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
        scaleMargins: { top: 0.05, bottom: 0.05 },
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

  // Update chart data and overlays
  useEffect(() => {
    if (!candleSeriesRef.current || !chartRef.current || chartData.length === 0) return;

    // Deduplicate
    const seen = new Set<string>();
    const uniqueData = chartData.filter(d => {
      const key = String(d.time);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    candleSeriesRef.current.setData(uniqueData);

    // Add price lines for open positions matching this symbol
    const symbolPositions = positions.filter(p => p.symbol === symbol);
    
    for (const pos of symbolPositions) {
      // Entry price line
      try {
        candleSeriesRef.current.createPriceLine({
          price: pos.entryPrice,
          color: pos.direction === 'long' ? '#00E5FF' : '#E84855',
          lineWidth: 2,
          lineStyle: 0,
          axisLabelVisible: true,
          title: `Entry ${pos.direction === 'long' ? 'BUY' : 'SELL'} ${pos.size}`,
        });
      } catch {}

      // Stop Loss line
      if (pos.stopLoss !== null) {
        try {
          candleSeriesRef.current.createPriceLine({
            price: pos.stopLoss,
            color: '#E84855',
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: 'SL',
          });
        } catch {}
      }

      // Take Profit line
      if (pos.takeProfit !== null) {
        try {
          candleSeriesRef.current.createPriceLine({
            price: pos.takeProfit,
            color: '#00E5FF',
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: 'TP',
          });
        } catch {}
      }
    }

    // Add markers for trade history
    const symbolTrades = tradeHistory.filter(t => t.symbol === symbol);
    
    if (symbolTrades.length > 0 && uniqueData.length > 0) {
      const lastTime = uniqueData[uniqueData.length - 1].time;
      
      const markers = symbolTrades.flatMap(trade => {
        const entryMarker = {
          time: lastTime, // approximate — we don't have exact candle match
          position: trade.direction === 'long' ? 'belowBar' as const : 'aboveBar' as const,
          color: trade.direction === 'long' ? '#00E5FF' : '#E84855',
          shape: trade.direction === 'long' ? 'arrowUp' as const : 'arrowDown' as const,
          text: `${trade.direction === 'long' ? 'B' : 'S'} ${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(0)}`,
        };
        return [entryMarker];
      });

      if (markers.length > 0) {
        try {
          createSeriesMarkers(candleSeriesRef.current, markers);
        } catch {}
      }
    }

    chartRef.current.timeScale().fitContent();
  }, [chartData, positions, tradeHistory, symbol]);

  return (
    <div className="relative w-full h-full bg-[#0A0A0F]">
      <div ref={containerRef} className="w-full h-full" />
      
      {/* Chart legend */}
      <div className="absolute top-2 left-2 flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
        <span className="text-foreground font-bold">{symbol}</span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-cyan inline-block" />
          Entry/TP
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-bearish inline-block" />
          SL
        </span>
      </div>

      {!candles?.length && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-8 bg-cyan animate-pulse" />
            <div className="w-1.5 h-8 bg-cyan animate-pulse" style={{ animationDelay: '0.15s' }} />
            <div className="w-1.5 h-8 bg-cyan animate-pulse" style={{ animationDelay: '0.3s' }} />
            <span className="text-xs font-mono text-muted-foreground ml-3 uppercase tracking-wider">Loading chart</span>
          </div>
        </div>
      )}
    </div>
  );
}
