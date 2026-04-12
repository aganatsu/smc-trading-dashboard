/**
 * AlertGeneratorPanel — Generate TradingView alerts for key SMC levels
 * Design: Obsidian Forge — Dark Brutalist Trading Interface
 * 
 * Provides one-click copy of alert conditions for:
 * - Order Blocks (unmitigated)
 * - Fair Value Gaps (unmitigated)
 * - 50% retracement level
 * - Key support/resistance levels
 * - Liquidity pool sweeps
 * 
 * Also includes webhook URL setup instructions for paid TradingView users.
 */

import { useState } from 'react';
import type { AnalysisResult } from '@/lib/smcAnalysis';
import type { Instrument } from '@/lib/marketData';
import { Bell, Copy, Check, ChevronDown, ChevronUp, ExternalLink, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  analysis: AnalysisResult | null;
  instrument: Instrument;
  currentPrice: number;
}

function formatPrice(price: number, instrument: Instrument): string {
  if (instrument.type === 'crypto') return price.toFixed(2);
  if (instrument.symbol.includes('JPY')) return price.toFixed(3);
  if (instrument.type === 'commodity') return price.toFixed(2);
  return price.toFixed(5);
}

interface AlertItem {
  id: string;
  type: 'ob' | 'fvg' | 'fib' | 'sr' | 'liquidity';
  label: string;
  price: number;
  priceEnd?: number;
  direction: 'above' | 'below' | 'crossing';
  priority: 'high' | 'medium' | 'low';
  description: string;
}

export default function AlertGeneratorPanel({ analysis, instrument, currentPrice }: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showWebhook, setShowWebhook] = useState(false);

  if (!analysis) {
    return (
      <div className="h-full">
        <div className="panel-header">
          <span className="panel-header-title">Alert Generator</span>
          <Bell className="w-3.5 h-3.5 text-cyan" />
        </div>
        <div className="panel-body">
          <div className="text-xs text-muted-foreground font-mono">Loading...</div>
        </div>
      </div>
    );
  }

  // Generate alert items from analysis
  const alerts: AlertItem[] = [];

  // 50% Level alert
  alerts.push({
    id: 'fib-50',
    type: 'fib',
    label: '50% MAJOR LEVEL',
    price: analysis.fiftyPercentLevel,
    direction: currentPrice > analysis.fiftyPercentLevel ? 'below' : 'above',
    priority: 'high',
    description: `Price approaching 50% retracement — key area of interest for ${analysis.entryChecklist.bias} setup`,
  });

  // Unmitigated Order Blocks
  analysis.orderBlocks
    .filter(ob => !ob.mitigated)
    .slice(0, 4)
    .forEach((ob, i) => {
      const midPrice = (ob.high + ob.low) / 2;
      alerts.push({
        id: `ob-${i}`,
        type: 'ob',
        label: `${ob.type.toUpperCase()} ORDER BLOCK`,
        price: ob.type === 'bullish' ? ob.high : ob.low,
        priceEnd: ob.type === 'bullish' ? ob.low : ob.high,
        direction: ob.type === 'bullish' ? 'below' : 'above',
        priority: 'high',
        description: `Fresh ${ob.type} OB zone: ${formatPrice(ob.low, instrument)} — ${formatPrice(ob.high, instrument)}`,
      });
    });

  // Unmitigated FVGs
  analysis.fvgs
    .filter(f => !f.mitigated)
    .slice(0, 3)
    .forEach((fvg, i) => {
      alerts.push({
        id: `fvg-${i}`,
        type: 'fvg',
        label: `${fvg.type.toUpperCase()} FVG`,
        price: fvg.type === 'bullish' ? fvg.high : fvg.low,
        priceEnd: fvg.type === 'bullish' ? fvg.low : fvg.high,
        direction: fvg.type === 'bullish' ? 'below' : 'above',
        priority: 'medium',
        description: `Fair Value Gap: ${formatPrice(fvg.low, instrument)} — ${formatPrice(fvg.high, instrument)}`,
      });
    });

  // Key Support/Resistance
  analysis.keySupport.slice(0, 2).forEach((level, i) => {
    alerts.push({
      id: `support-${i}`,
      type: 'sr',
      label: `SUPPORT S${i + 1}`,
      price: level,
      direction: 'below',
      priority: 'medium',
      description: `Price approaching support level at ${formatPrice(level, instrument)}`,
    });
  });

  analysis.keyResistance.slice(0, 2).forEach((level, i) => {
    alerts.push({
      id: `resist-${i}`,
      type: 'sr',
      label: `RESISTANCE R${i + 1}`,
      price: level,
      direction: 'above',
      priority: 'medium',
      description: `Price approaching resistance level at ${formatPrice(level, instrument)}`,
    });
  });

  // Liquidity pools (unswept)
  analysis.liquidityPools
    .filter(lp => !lp.swept)
    .slice(0, 2)
    .forEach((lp, i) => {
      alerts.push({
        id: `liq-${i}`,
        type: 'liquidity',
        label: `${lp.type === 'buy-side' ? 'BSL' : 'SSL'} LIQUIDITY`,
        price: lp.price,
        direction: lp.type === 'buy-side' ? 'above' : 'below',
        priority: 'low',
        description: `${lp.type === 'buy-side' ? 'Buy-side' : 'Sell-side'} liquidity pool (${lp.strength}x touches)`,
      });
    });

  const copyAlert = (alert: AlertItem) => {
    const tvSymbol = getTVSymbolDisplay(instrument);
    const text = `${tvSymbol} Alert: ${alert.label}\nPrice: ${formatPrice(alert.price, instrument)}\nCondition: Price ${alert.direction === 'above' ? 'crosses above' : alert.direction === 'below' ? 'crosses below' : 'crosses'} ${formatPrice(alert.price, instrument)}\n${alert.description}`;
    
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(alert.id);
      toast.success('Alert details copied to clipboard');
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const copyAllAlerts = () => {
    const tvSymbol = getTVSymbolDisplay(instrument);
    const text = alerts.map(a => 
      `${a.label}: ${formatPrice(a.price, instrument)} (${a.direction === 'above' ? 'crosses above' : a.direction === 'below' ? 'crosses below' : 'crosses'})`
    ).join('\n');
    
    navigator.clipboard.writeText(`${tvSymbol} — SMC Alert Levels\n${'—'.repeat(30)}\n${text}`).then(() => {
      toast.success(`${alerts.length} alert levels copied`);
    });
  };

  const priorityColor = (p: string) => {
    if (p === 'high') return 'text-bearish';
    if (p === 'medium') return 'text-warning';
    return 'text-muted-foreground';
  };

  const priorityBg = (p: string) => {
    if (p === 'high') return 'bg-bearish/10 border-l-bearish';
    if (p === 'medium') return 'bg-warning/10 border-l-[#FFB800]';
    return 'bg-muted/30 border-l-muted-foreground';
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case 'ob': return '◼';
      case 'fvg': return '◻';
      case 'fib': return '◈';
      case 'sr': return '━';
      case 'liquidity': return '◉';
      default: return '•';
    }
  };

  return (
    <div className="h-full">
      <div className="panel-header">
        <span className="panel-header-title">Alert Generator</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-cyan">{alerts.length} alerts</span>
          <Bell className="w-3.5 h-3.5 text-cyan" />
        </div>
      </div>
      <div className="panel-body space-y-3">
        {/* Copy All Button */}
        <button
          onClick={copyAllAlerts}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground font-bold text-[11px] uppercase tracking-wider hover:opacity-90 transition-opacity"
        >
          <Copy className="w-3.5 h-3.5" />
          COPY ALL ALERT LEVELS
        </button>

        {/* Alert List */}
        <div className="space-y-1.5">
          {alerts.map(alert => (
            <div
              key={alert.id}
              className={`px-3 py-2 border-l-2 ${priorityBg(alert.priority)} cursor-pointer hover:opacity-80 transition-opacity`}
              onClick={() => copyAlert(alert)}
            >
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono">{typeIcon(alert.type)}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">
                    {alert.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-bold uppercase ${priorityColor(alert.priority)}`}>
                    {alert.priority}
                  </span>
                  {copiedId === alert.id ? (
                    <Check className="w-3 h-3 text-bullish" />
                  ) : (
                    <Copy className="w-3 h-3 text-muted-foreground" />
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold text-cyan">
                  {formatPrice(alert.price, instrument)}
                  {alert.priceEnd && ` — ${formatPrice(alert.priceEnd, instrument)}`}
                </span>
                <span className="text-[9px] font-mono text-muted-foreground uppercase">
                  {alert.direction === 'above' ? '↑ ABOVE' : alert.direction === 'below' ? '↓ BELOW' : '↕ CROSS'}
                </span>
              </div>
              <div className="text-[9px] text-muted-foreground font-mono mt-0.5">
                {alert.description}
              </div>
            </div>
          ))}
        </div>

        {/* TradingView Setup Instructions */}
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="w-full flex items-center justify-between py-2 px-3 bg-muted/30 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>HOW TO SET ALERTS IN TRADINGVIEW</span>
          {showInstructions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showInstructions && (
          <div className="px-3 py-3 bg-muted/20 space-y-2">
            <div className="text-[10px] font-mono text-muted-foreground space-y-1.5">
              <p className="text-foreground font-bold">Quick Setup:</p>
              <p>1. Open TradingView Desktop App</p>
              <p>2. Navigate to the same symbol ({getTVSymbolDisplay(instrument)})</p>
              <p>3. Press <span className="text-cyan font-bold">Alt + A</span> (Windows) or <span className="text-cyan font-bold">⌥ + A</span> (Mac)</p>
              <p>4. Set condition: <span className="text-cyan">Price</span> → <span className="text-cyan">Crossing</span> → enter the price level</p>
              <p>5. Set alert name to match the level type (e.g., "EURUSD Bullish OB")</p>
              <p>6. Set expiration and notification method</p>
              <p>7. Click <span className="text-cyan font-bold">Create</span></p>
            </div>
          </div>
        )}

        {/* Webhook Setup */}
        <button
          onClick={() => setShowWebhook(!showWebhook)}
          className="w-full flex items-center justify-between py-2 px-3 bg-cyan/5 text-[10px] font-bold uppercase tracking-wider text-cyan hover:opacity-80 transition-opacity"
        >
          <div className="flex items-center gap-2">
            <Zap className="w-3 h-3" />
            <span>WEBHOOK ALERTS (PAID PLAN)</span>
          </div>
          {showWebhook ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showWebhook && (
          <div className="px-3 py-3 bg-cyan/5 space-y-2">
            <div className="text-[10px] font-mono text-muted-foreground space-y-1.5">
              <p className="text-foreground font-bold">Webhook Setup (Requires Paid TradingView Plan):</p>
              <p>Webhooks let TradingView send automatic notifications to external services when alerts trigger.</p>
              <p className="mt-2 text-foreground font-bold">Steps:</p>
              <p>1. Create an alert as described above</p>
              <p>2. In the alert dialog, check <span className="text-cyan">"Webhook URL"</span></p>
              <p>3. Enter your webhook endpoint URL</p>
              <p>4. In the "Message" field, use this template:</p>
              <div className="bg-background/50 p-2 mt-1 border border-border">
                <code className="text-[9px] text-cyan">
                  {`{"symbol":"${getTVSymbolDisplay(instrument)}","action":"{{strategy.order.action}}","price":"{{close}}","time":"{{time}}","alert":"{{alertname}}"}`}
                </code>
              </div>
              <p className="mt-2">Popular webhook services:</p>
              <div className="space-y-1 mt-1">
                <a href="https://www.pineconnector.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-cyan hover:underline">
                  PineConnector <ExternalLink className="w-2.5 h-2.5" />
                </a>
                <a href="https://traderspost.io" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-cyan hover:underline">
                  TradersPost <ExternalLink className="w-2.5 h-2.5" />
                </a>
                <a href="https://3commas.io" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-cyan hover:underline">
                  3Commas <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getTVSymbolDisplay(instrument: Instrument): string {
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
  return symbolMap[instrument.symbol] || instrument.symbol;
}
