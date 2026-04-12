/**
 * RiskManagementPanel — Position sizing, R:R calculator, exit checklist
 * Design: Obsidian Forge — Dark Brutalist Trading Interface
 */

import { useState, useMemo } from 'react';
import type { AnalysisResult } from '@/lib/smcAnalysis';
import type { Instrument } from '@/lib/marketData';

interface Props {
  analysis: AnalysisResult | null;
  instrument: Instrument;
  currentPrice: number;
}

export default function RiskManagementPanel({ analysis, instrument, currentPrice }: Props) {
  const [accountSize, setAccountSize] = useState(10000);
  const [riskPercent, setRiskPercent] = useState(1);
  const [entryPrice, setEntryPrice] = useState(0);
  const [stopLoss, setStopLoss] = useState(0);
  const [takeProfit, setTakeProfit] = useState(0);

  // Auto-suggest entry, SL, TP based on analysis
  useMemo(() => {
    if (!analysis || !currentPrice) return;
    
    setEntryPrice(currentPrice);
    
    // Suggest SL at nearest support/resistance
    if (analysis.entryChecklist.bias === 'bullish' && analysis.keySupport.length > 0) {
      setStopLoss(analysis.keySupport[0]);
      if (analysis.keyResistance.length > 0) {
        setTakeProfit(analysis.keyResistance[0]);
      }
    } else if (analysis.entryChecklist.bias === 'bearish' && analysis.keyResistance.length > 0) {
      setStopLoss(analysis.keyResistance[0]);
      if (analysis.keySupport.length > 0) {
        setTakeProfit(analysis.keySupport[0]);
      }
    }
  }, [analysis, currentPrice]);

  const riskAmount = accountSize * (riskPercent / 100);
  const slDistance = Math.abs(entryPrice - stopLoss);
  const tpDistance = Math.abs(takeProfit - entryPrice);
  const rrRatio = slDistance > 0 ? tpDistance / slDistance : 0;
  
  // Position size calculation (simplified for forex lots)
  const pipValue = instrument.type === 'forex' 
    ? (instrument.symbol.includes('JPY') ? 0.01 : 0.0001)
    : instrument.type === 'crypto' ? 1 : 0.01;
  const slPips = slDistance / pipValue;
  const positionSize = slPips > 0 ? riskAmount / slPips : 0;

  const formatPrice = (price: number): string => {
    if (instrument.type === 'crypto') return price.toFixed(2);
    if (instrument.symbol.includes('JPY')) return price.toFixed(3);
    if (instrument.type === 'commodity') return price.toFixed(2);
    return price.toFixed(5);
  };

  return (
    <div className="h-full">
      <div className="panel-header">
        <span className="panel-header-title">Risk Management</span>
      </div>
      <div className="panel-body space-y-4">
        {/* Account & Risk Settings */}
        <div>
          <div className="section-label mb-2">ACCOUNT SETTINGS</div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-mono text-muted-foreground">ACCOUNT SIZE</label>
              <div className="flex items-center gap-1 bg-muted px-2 py-1">
                <span className="text-[10px] text-muted-foreground">$</span>
                <input
                  type="number"
                  value={accountSize}
                  onChange={e => setAccountSize(Number(e.target.value))}
                  className="w-20 bg-transparent text-xs font-mono text-foreground outline-none text-right"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-mono text-muted-foreground">RISK %</label>
              <div className="flex items-center gap-1 bg-muted px-2 py-1">
                <input
                  type="number"
                  value={riskPercent}
                  onChange={e => setRiskPercent(Number(e.target.value))}
                  step={0.5}
                  min={0.1}
                  max={10}
                  className="w-16 bg-transparent text-xs font-mono text-foreground outline-none text-right"
                />
                <span className="text-[10px] text-muted-foreground">%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Trade Parameters */}
        <div>
          <div className="section-label mb-2">TRADE PARAMETERS</div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-mono text-cyan">ENTRY</label>
              <input
                type="number"
                value={entryPrice || ''}
                onChange={e => setEntryPrice(Number(e.target.value))}
                step={pipValue}
                className="w-28 bg-muted px-2 py-1 text-xs font-mono text-foreground outline-none text-right border-l-2 border-l-cyan"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-mono text-bearish">STOP LOSS</label>
              <input
                type="number"
                value={stopLoss || ''}
                onChange={e => setStopLoss(Number(e.target.value))}
                step={pipValue}
                className="w-28 bg-muted px-2 py-1 text-xs font-mono text-foreground outline-none text-right border-l-2 border-l-bearish"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-mono text-bullish">TAKE PROFIT</label>
              <input
                type="number"
                value={takeProfit || ''}
                onChange={e => setTakeProfit(Number(e.target.value))}
                step={pipValue}
                className="w-28 bg-muted px-2 py-1 text-xs font-mono text-foreground outline-none text-right border-l-2 border-l-bullish"
              />
            </div>
          </div>
        </div>

        {/* Calculated Values */}
        <div>
          <div className="section-label mb-2">CALCULATED</div>
          <div className="space-y-1">
            <div className="flex items-center justify-between px-2 py-1.5 bg-muted/30">
              <span className="text-[10px] font-mono text-muted-foreground">RISK AMOUNT</span>
              <span className="text-xs font-bold font-mono text-bearish">${riskAmount.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between px-2 py-1.5 bg-muted/30">
              <span className="text-[10px] font-mono text-muted-foreground">SL DISTANCE</span>
              <span className="text-xs font-mono text-foreground">{formatPrice(slDistance)}</span>
            </div>
            <div className={`flex items-center justify-between px-2 py-1.5 ${
              rrRatio >= 2 ? 'bg-bullish/10 border-l-2 border-l-bullish' :
              rrRatio >= 1 ? 'bg-warning/10 border-l-2 border-l-[#FFB800]' :
              'bg-bearish/10 border-l-2 border-l-bearish'
            }`}>
              <span className="text-[10px] font-mono text-muted-foreground">R:R RATIO</span>
              <span className={`text-sm font-bold font-mono ${
                rrRatio >= 2 ? 'text-bullish' : rrRatio >= 1 ? 'text-[#FFB800]' : 'text-bearish'
              }`}>
                1:{rrRatio.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between px-2 py-1.5 bg-cyan/5 border-l-2 border-l-cyan">
              <span className="text-[10px] font-mono text-muted-foreground">POSITION SIZE</span>
              <span className="text-sm font-bold font-mono text-cyan">
                {instrument.type === 'forex' ? `${(positionSize / 100000).toFixed(2)} lots` :
                 instrument.type === 'crypto' ? `${positionSize.toFixed(6)} units` :
                 `${positionSize.toFixed(2)} units`}
              </span>
            </div>
          </div>
        </div>

        {/* Exit Checklist */}
        <div>
          <div className="section-label mb-2">EXIT STRATEGY</div>
          <div className="space-y-1">
            <div className="px-2 py-1.5 bg-muted/30 text-[10px] font-mono">
              <span className="text-muted-foreground">PARTIAL EXIT: </span>
              <span className="text-foreground">50% at 1R, move SL to BE</span>
            </div>
            <div className="px-2 py-1.5 bg-muted/30 text-[10px] font-mono">
              <span className="text-muted-foreground">FULL EXIT: </span>
              <span className="text-foreground">Remaining at TP or trailing stop</span>
            </div>
            <div className="px-2 py-1.5 bg-muted/30 text-[10px] font-mono">
              <span className="text-muted-foreground">TRAILING STOP: </span>
              <span className="text-cyan">Recommended</span>
            </div>
          </div>
        </div>

        {/* Post-Trade Review Reminder */}
        <div className="px-3 py-2 bg-muted/20 border-l-2 border-l-muted-foreground">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
            POST-TRADE REVIEW
          </div>
          <div className="text-[10px] text-muted-foreground font-mono">
            Did you follow the strategy? Note any deviations and areas for improvement.
          </div>
        </div>
      </div>
    </div>
  );
}
