/**
 * TradingViewChart — Embedded TradingView Advanced Chart Widget
 * Design: Obsidian Forge — Dark Brutalist Trading Interface
 * 
 * Embeds the official TradingView Advanced Chart widget with dark theme,
 * full drawing tools, indicators, and real-time data.
 */

import { useEffect, useRef, memo } from 'react';
import type { Instrument, Timeframe } from '@/lib/marketData';

interface Props {
  instrument: Instrument;
  timeframe: Timeframe;
  loading: boolean;
}

// Map our instrument symbols to TradingView symbol format
function getTVSymbol(instrument: Instrument): string {
  const symbolMap: Record<string, string> = {
    'EUR/USD': 'FX:EURUSD',
    'GBP/USD': 'FX:GBPUSD',
    'USD/JPY': 'FX:USDJPY',
    'GBP/JPY': 'FX:GBPJPY',
    'AUD/USD': 'FX:AUDUSD',
    'USD/CAD': 'FX:USDCAD',
    'EUR/GBP': 'FX:EURGBP',
    'NZD/USD': 'FX:NZDUSD',
    'BTC/USD': 'BITSTAMP:BTCUSD',
    'ETH/USD': 'BITSTAMP:ETHUSD',
    'XAU/USD': 'OANDA:XAUUSD',
    'XAG/USD': 'OANDA:XAGUSD',
  };
  return symbolMap[instrument.symbol] || instrument.symbol.replace('/', '');
}

// Map our timeframe to TradingView interval format
function getTVInterval(timeframe: Timeframe): string {
  const intervalMap: Record<Timeframe, string> = {
    '1week': 'W',
    '1day': 'D',
    '4h': '240',
    '1h': '60',
    '15min': '15',
    '5min': '5',
  };
  return intervalMap[timeframe] || 'D';
}

function TradingViewChart({ instrument, timeframe, loading }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget
    const container = containerRef.current;
    container.innerHTML = '';

    // Create widget container structure
    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container';
    widgetContainer.style.height = '100%';
    widgetContainer.style.width = '100%';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.height = '100%';
    widgetDiv.style.width = '100%';
    widgetContainer.appendChild(widgetDiv);

    container.appendChild(widgetContainer);

    // Create and inject the TradingView script
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: getTVSymbol(instrument),
      interval: getTVInterval(timeframe),
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1', // Candlestick
      locale: 'en',
      allow_symbol_change: true,
      calendar: false,
      details: false,
      hotlist: false,
      hide_top_toolbar: false,
      hide_side_toolbar: false,
      hide_legend: false,
      hide_volume: false,
      save_image: true,
      withdateranges: true,
      support_host: 'https://www.tradingview.com',
      backgroundColor: 'rgba(10, 10, 15, 1)',
      gridColor: 'rgba(255, 255, 255, 0.03)',
      studies: [],
      watchlist: [
        'FX:EURUSD',
        'FX:GBPUSD',
        'FX:USDJPY',
        'FX:GBPJPY',
        'BITSTAMP:BTCUSD',
        'OANDA:XAUUSD',
      ],
    });

    widgetContainer.appendChild(script);
    scriptRef.current = script;

    return () => {
      container.innerHTML = '';
      scriptRef.current = null;
    };
  }, [instrument.symbol, timeframe]);

  return (
    <div className="relative w-full h-full bg-[#0A0A0F]">
      <div ref={containerRef} className="w-full h-full" />
      
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-8 bg-cyan animate-pulse" />
            <div className="w-1.5 h-8 bg-cyan animate-pulse" style={{ animationDelay: '0.15s' }} />
            <div className="w-1.5 h-8 bg-cyan animate-pulse" style={{ animationDelay: '0.3s' }} />
            <span className="text-xs font-mono text-muted-foreground ml-3 uppercase tracking-wider">Loading</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(TradingViewChart);
