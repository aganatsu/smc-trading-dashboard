/**
 * EntryChecklistPanel — Auto-filled entry checklist based on SMC analysis
 * Design: Obsidian Forge — Dark Brutalist Trading Interface
 */

import type { AnalysisResult } from '@/lib/smcAnalysis';
import { Check, X, AlertTriangle } from 'lucide-react';

interface Props {
  analysis: AnalysisResult | null;
}

export default function EntryChecklistPanel({ analysis }: Props) {
  if (!analysis) {
    return (
      <div className="h-full">
        <div className="panel-header">
          <span className="panel-header-title">Entry Checklist</span>
        </div>
        <div className="panel-body">
          <div className="text-xs text-muted-foreground font-mono">Loading...</div>
        </div>
      </div>
    );
  }

  const { entryChecklist } = analysis;
  const scoreColor = entryChecklist.overallScore >= 3 ? 'text-bullish' :
    entryChecklist.overallScore >= 2 ? 'text-warning' : 'text-bearish';
  const scoreLabel = entryChecklist.overallScore >= 3 ? 'STRONG' :
    entryChecklist.overallScore >= 2 ? 'MODERATE' : 'WEAK';

  const checkItems = [
    {
      label: 'RETRACE TO OB / FVG',
      status: entryChecklist.retraceToOBFVG.status,
      detail: entryChecklist.retraceToOBFVG.detail,
    },
    {
      label: 'CONFLUENCE WITH KEY LEVELS',
      status: entryChecklist.confluenceWithKeyLevels.status,
      detail: entryChecklist.confluenceWithKeyLevels.detail,
    },
    {
      label: 'MARKET STRUCTURE SHIFT (LTF)',
      status: entryChecklist.marketStructureShiftLTF.status,
      detail: entryChecklist.marketStructureShiftLTF.detail,
    },
    {
      label: 'REVERSAL CANDLE CONFIRMED',
      status: entryChecklist.reversalCandleConfirmed.status,
      detail: entryChecklist.reversalCandleConfirmed.detail,
    },
  ];

  return (
    <div className="h-full">
      <div className="panel-header">
        <span className="panel-header-title">Entry Checklist</span>
        <div className="flex items-center gap-2">
          <span className={`text-lg font-bold font-mono ${scoreColor}`}>
            {entryChecklist.overallScore}/4
          </span>
        </div>
      </div>
      <div className="panel-body space-y-4">
        {/* Overall Score */}
        <div className={`px-3 py-3 border-l-3 ${
          entryChecklist.overallScore >= 3 ? 'border-l-bullish bg-bullish/5' :
          entryChecklist.overallScore >= 2 ? 'border-l-[#FFB800] bg-warning/5' :
          'border-l-bearish bg-bearish/5'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <div className={`text-sm font-bold uppercase tracking-wider ${scoreColor}`}>
                {scoreLabel} SETUP
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Bias: <span className={`font-bold ${
                  entryChecklist.bias === 'bullish' ? 'text-bullish' :
                  entryChecklist.bias === 'bearish' ? 'text-bearish' :
                  'text-muted-foreground'
                }`}>{entryChecklist.bias.toUpperCase()}</span>
              </div>
            </div>
            {entryChecklist.overallScore >= 3 ? (
              <div className="w-8 h-8 flex items-center justify-center bg-bullish/20 border-2 border-bullish">
                <Check className="w-5 h-5 text-bullish" />
              </div>
            ) : entryChecklist.overallScore >= 2 ? (
              <div className="w-8 h-8 flex items-center justify-center bg-warning/20 border-2 border-[#FFB800]">
                <AlertTriangle className="w-5 h-5 text-[#FFB800]" />
              </div>
            ) : (
              <div className="w-8 h-8 flex items-center justify-center bg-bearish/20 border-2 border-bearish">
                <X className="w-5 h-5 text-bearish" />
              </div>
            )}
          </div>

          {/* Score bar */}
          <div className="mt-3 flex gap-1">
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className={`h-1.5 flex-1 ${
                  i < entryChecklist.overallScore
                    ? entryChecklist.overallScore >= 3 ? 'bg-bullish' :
                      entryChecklist.overallScore >= 2 ? 'bg-[#FFB800]' : 'bg-bearish'
                    : 'bg-muted'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Checklist Items */}
        <div className="space-y-2">
          {checkItems.map((item, i) => (
            <div key={i} className={`px-3 py-2 border-l-2 ${
              item.status ? 'border-l-bullish bg-bullish/5' : 'border-l-muted-foreground bg-muted/30'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">
                  {item.label}
                </span>
                {item.status ? (
                  <Check className="w-3.5 h-3.5 text-bullish" />
                ) : (
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </div>
              <div className="text-[10px] text-muted-foreground font-mono">
                {item.detail}
              </div>
            </div>
          ))}
        </div>

        {/* Trend Line Note */}
        <div className="px-3 py-2 bg-cyan/5 border-l-2 border-l-cyan">
          <div className="text-[10px] font-bold uppercase tracking-wider text-cyan mb-1">
            TREND LINE NOTE
          </div>
          <div className="text-[10px] text-muted-foreground font-mono">
            {analysis.structure.trend === 'bullish'
              ? 'Look for trend line support holds as additional confluence for long entries.'
              : analysis.structure.trend === 'bearish'
                ? 'Look for trend line resistance holds as additional confluence for short entries.'
                : 'No clear trend line direction — wait for structure to develop.'}
          </div>
        </div>

        {/* 50% Rule Reminder */}
        <div className="px-3 py-2 bg-warning/5 border-l-2 border-l-[#FFB800]">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#FFB800] mb-1">
            50% RULE
          </div>
          <div className="text-[10px] text-muted-foreground font-mono">
            Mark 50% on major TF. Buy/sell before price reaches that level. If mitigation zone hasn't been tested 50%, it is still valid.
          </div>
        </div>
      </div>
    </div>
  );
}
