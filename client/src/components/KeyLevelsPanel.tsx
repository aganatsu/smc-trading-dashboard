/**
 * KeyLevelsPanel — Support/Resistance, Order Blocks, FVGs, Liquidity, Fibonacci
 * Design: Obsidian Forge — Dark Brutalist Trading Interface
 */

import type { AnalysisResult } from '@/lib/smcAnalysis';
import type { Instrument } from '@/lib/marketData';

interface Props {
  analysis: AnalysisResult | null;
  instrument: Instrument;
}

function formatPrice(price: number, instrument: Instrument): string {
  if (instrument.type === 'crypto') return price.toFixed(2);
  if (instrument.symbol.includes('JPY')) return price.toFixed(3);
  if (instrument.type === 'commodity') return price.toFixed(2);
  return price.toFixed(5);
}

export default function KeyLevelsPanel({ analysis, instrument }: Props) {
  if (!analysis) {
    return (
      <div className="h-full">
        <div className="panel-header">
          <span className="panel-header-title">Key Levels & Zones</span>
        </div>
        <div className="panel-body">
          <div className="text-xs text-muted-foreground font-mono">Loading...</div>
        </div>
      </div>
    );
  }

  const unmitigatedOBs = analysis.orderBlocks.filter(ob => !ob.mitigated);
  const mitigatedOBs = analysis.orderBlocks.filter(ob => ob.mitigated);
  const unmitigatedFVGs = analysis.fvgs.filter(f => !f.mitigated);

  return (
    <div className="h-full">
      <div className="panel-header">
        <span className="panel-header-title">Key Levels & Zones</span>
        <span className="text-[10px] font-mono text-cyan">{analysis.orderBlocks.length + analysis.fvgs.length} zones</span>
      </div>
      <div className="panel-body space-y-4">
        {/* 50% Level */}
        <div>
          <div className="section-label mb-1">50% MAJOR LEVEL</div>
          <div className="flex items-center gap-2 px-3 py-2 bg-warning/10 border-l-3 border-l-[#FFB800]">
            <span className="text-sm font-bold font-mono text-[#FFB800]">
              {formatPrice(analysis.fiftyPercentLevel, instrument)}
            </span>
            <span className="text-[10px] text-muted-foreground">KEY AREA OF INTEREST</span>
          </div>
        </div>

        {/* Support & Resistance */}
        <div>
          <div className="section-label mb-1">SUPPORT & RESISTANCE</div>
          <div className="space-y-1">
            {analysis.keyResistance.slice(0, 3).map((r, i) => (
              <div key={`r-${i}`} className="flex items-center justify-between px-2 py-1 text-[11px] font-mono">
                <span className="text-bearish">R{i + 1}</span>
                <span className="text-foreground">{formatPrice(r, instrument)}</span>
              </div>
            ))}
            {analysis.keySupport.slice(0, 3).map((s, i) => (
              <div key={`s-${i}`} className="flex items-center justify-between px-2 py-1 text-[11px] font-mono">
                <span className="text-bullish">S{i + 1}</span>
                <span className="text-foreground">{formatPrice(s, instrument)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Order Blocks */}
        <div>
          <div className="section-label mb-1">
            ORDER BLOCKS
            <span className="text-cyan ml-2">{unmitigatedOBs.length} fresh</span>
          </div>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {unmitigatedOBs.slice(0, 5).map((ob, i) => (
              <div key={`ob-${i}`} className={`flex items-center justify-between px-2 py-1 text-[11px] font-mono border-l-2 ${
                ob.type === 'bullish' ? 'border-l-bullish bg-bullish/5' : 'border-l-bearish bg-bearish/5'
              }`}>
                <span className={ob.type === 'bullish' ? 'text-bullish' : 'text-bearish'}>
                  {ob.type === 'bullish' ? 'BUL' : 'BER'}
                </span>
                <span className="text-foreground">
                  {formatPrice(ob.low, instrument)} — {formatPrice(ob.high, instrument)}
                </span>
                <span className="text-cyan text-[9px]">FRESH</span>
              </div>
            ))}
            {mitigatedOBs.slice(0, 3).map((ob, i) => (
              <div key={`mob-${i}`} className="flex items-center justify-between px-2 py-1 text-[11px] font-mono opacity-50">
                <span className="text-muted-foreground">
                  {ob.type === 'bullish' ? 'BUL' : 'BER'}
                </span>
                <span className="text-muted-foreground">
                  {formatPrice(ob.low, instrument)} — {formatPrice(ob.high, instrument)}
                </span>
                <span className="text-[9px]">{ob.mitigatedPercent.toFixed(0)}% MIT</span>
              </div>
            ))}
            {analysis.orderBlocks.length === 0 && (
              <div className="text-[11px] text-muted-foreground font-mono py-1">None detected</div>
            )}
          </div>
        </div>

        {/* Fair Value Gaps */}
        <div>
          <div className="section-label mb-1">
            FAIR VALUE GAPS
            <span className="text-cyan ml-2">{unmitigatedFVGs.length} open</span>
          </div>
          <div className="space-y-1 max-h-20 overflow-y-auto">
            {unmitigatedFVGs.slice(0, 4).map((fvg, i) => (
              <div key={`fvg-${i}`} className={`flex items-center justify-between px-2 py-1 text-[11px] font-mono border-l-2 ${
                fvg.type === 'bullish' ? 'border-l-bullish bg-bullish/5' : 'border-l-bearish bg-bearish/5'
              }`}>
                <span className={fvg.type === 'bullish' ? 'text-bullish' : 'text-bearish'}>FVG</span>
                <span className="text-foreground">
                  {formatPrice(fvg.low, instrument)} — {formatPrice(fvg.high, instrument)}
                </span>
              </div>
            ))}
            {analysis.fvgs.length === 0 && (
              <div className="text-[11px] text-muted-foreground font-mono py-1">None detected</div>
            )}
          </div>
        </div>

        {/* Liquidity Pools */}
        <div>
          <div className="section-label mb-1">LIQUIDITY POOLS</div>
          <div className="space-y-1 max-h-20 overflow-y-auto">
            {analysis.liquidityPools.slice(0, 4).map((lp, i) => (
              <div key={`lp-${i}`} className={`flex items-center justify-between px-2 py-1 text-[11px] font-mono ${
                lp.swept ? 'opacity-40' : ''
              }`}>
                <span className={lp.type === 'buy-side' ? 'text-bullish' : 'text-bearish'}>
                  {lp.type === 'buy-side' ? 'BSL' : 'SSL'}
                </span>
                <span className="text-foreground">{formatPrice(lp.price, instrument)}</span>
                <span className="text-[9px] text-muted-foreground">{lp.strength}x</span>
                {lp.swept && <span className="text-[9px] text-warning">SWEPT</span>}
              </div>
            ))}
            {analysis.liquidityPools.length === 0 && (
              <div className="text-[11px] text-muted-foreground font-mono py-1">None detected</div>
            )}
          </div>
        </div>

        {/* Fibonacci Levels */}
        <div>
          <div className="section-label mb-1">FIBONACCI RETRACEMENT</div>
          <div className="space-y-0.5">
            {analysis.fibLevels.map((fib, i) => (
              <div key={`fib-${i}`} className={`flex items-center justify-between px-2 py-0.5 text-[11px] font-mono ${
                fib.label === '50%' ? 'bg-warning/10 text-[#FFB800] font-bold' :
                fib.label === '61.8%' || fib.label === '38.2%' ? 'text-cyan' :
                'text-muted-foreground'
              }`}>
                <span>{fib.label}</span>
                <span>{formatPrice(fib.price, instrument)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
