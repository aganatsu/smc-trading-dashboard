import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import {
  Settings2, Shield, ArrowRightLeft, LogOut, Filter, Clock, Bell, Wallet,
  ChevronDown, ChevronRight, RotateCcw, Save, Zap, Target, TrendingUp,
  AlertTriangle, ToggleLeft, ToggleRight,
} from 'lucide-react';

// ─── Types (mirror server/botConfig.ts) ─────────────────────────────

type ConfigSection = 'strategy' | 'risk' | 'entry' | 'exit' | 'instruments' | 'sessions' | 'notifications' | 'protection';

const SECTION_META: { key: ConfigSection; label: string; icon: React.ReactNode; description: string }[] = [
  { key: 'strategy', label: 'Strategy', icon: <Zap size={16} />, description: 'SMC setups, confluence, timeframes' },
  { key: 'risk', label: 'Risk Management', icon: <Shield size={16} />, description: 'Position sizing, limits, drawdown' },
  { key: 'entry', label: 'Entry Rules', icon: <ArrowRightLeft size={16} />, description: 'Order type, pyramiding, cooldown' },
  { key: 'exit', label: 'Exit Rules', icon: <LogOut size={16} />, description: 'TP/SL methods, trailing, partial TP' },
  { key: 'instruments', label: 'Instruments', icon: <Filter size={16} />, description: 'Allowed pairs, spread/volatility' },
  { key: 'sessions', label: 'Sessions', icon: <Clock size={16} />, description: 'Trading hours, days, news filter' },
  { key: 'notifications', label: 'Notifications', icon: <Bell size={16} />, description: 'Trade/signal/error alerts' },
  { key: 'protection', label: 'Protection', icon: <AlertTriangle size={16} />, description: 'Daily limits, halt conditions' },
];

// ─── Reusable Controls ──────────────────────────────────────────────

function Toggle({ value, onChange, label, description }: { value: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div className="flex items-center justify-between py-2 px-1 group">
      <div className="flex-1 min-w-0 mr-4">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {description && <div className="text-xs text-muted-foreground mt-0.5">{description}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${value ? 'bg-emerald-500' : 'bg-zinc-600'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}

function NumberInput({ value, onChange, label, description, min, max, step, suffix }: {
  value: number; onChange: (v: number) => void; label: string; description?: string;
  min?: number; max?: number; step?: number; suffix?: string;
}) {
  return (
    <div className="py-2 px-1">
      <div className="flex items-center justify-between mb-1">
        <div>
          <div className="text-sm font-medium text-foreground">{label}</div>
          {description && <div className="text-xs text-muted-foreground mt-0.5">{description}</div>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          min={min}
          max={max}
          step={step || 1}
          className="w-24 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-foreground focus:border-cyan-500 focus:outline-none"
        />
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

function SelectInput({ value, onChange, label, description, options }: {
  value: string; onChange: (v: string) => void; label: string; description?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="py-2 px-1">
      <div className="text-sm font-medium text-foreground mb-1">{label}</div>
      {description && <div className="text-xs text-muted-foreground mb-1">{description}</div>}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-foreground focus:border-cyan-500 focus:outline-none"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function SectionHeader({ title, collapsed, onToggle }: { title: string; collapsed: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="flex items-center gap-2 w-full py-2 px-1 text-xs font-bold uppercase tracking-wider text-cyan-400 hover:text-cyan-300">
      {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
      {title}
    </button>
  );
}

function TimeInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="flex items-center gap-2 py-1 px-1">
      <span className="text-xs text-muted-foreground w-12">{label}</span>
      <input
        type="time"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-foreground focus:border-cyan-500 focus:outline-none"
      />
    </div>
  );
}

// ─── Section Renderers ──────────────────────────────────────────────

function StrategySection({ config, onChange }: { config: any; onChange: (key: string, val: any) => void }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setCollapsed(p => ({ ...p, [k]: !p[k] }));

  return (
    <div className="space-y-1">
      <SectionHeader title="SMC Setup Toggles" collapsed={!!collapsed.setups} onToggle={() => toggle('setups')} />
      {!collapsed.setups && (
        <div className="pl-2 border-l border-zinc-700/50">
          <Toggle label="Break of Structure (BOS)" description="Detect structural breaks for trend continuation" value={config.enableBOS} onChange={v => onChange('enableBOS', v)} />
          <Toggle label="Change of Character (CHoCH)" description="Detect character changes for reversals" value={config.enableCHoCH} onChange={v => onChange('enableCHoCH', v)} />
          <Toggle label="Order Blocks (OB)" description="Identify institutional order blocks" value={config.enableOB} onChange={v => onChange('enableOB', v)} />
          <Toggle label="Fair Value Gaps (FVG)" description="Detect imbalances in price" value={config.enableFVG} onChange={v => onChange('enableFVG', v)} />
          <Toggle label="Liquidity Sweep" description="Detect stop hunts and liquidity grabs" value={config.enableLiquiditySweep} onChange={v => onChange('enableLiquiditySweep', v)} />
        </div>
      )}

      <SectionHeader title="Confluence & Bias" collapsed={!!collapsed.confluence} onToggle={() => toggle('confluence')} />
      {!collapsed.confluence && (
        <div className="pl-2 border-l border-zinc-700/50">
          <NumberInput label="Min Confluence Score" description="Minimum confirmations needed (1-10)" value={config.minConfluenceScore} onChange={v => onChange('minConfluenceScore', v)} min={1} max={10} suffix="/10" />
          <Toggle label="HTF Bias Required" description="Must align with higher timeframe trend" value={config.htfBiasRequired} onChange={v => onChange('htfBiasRequired', v)} />
          <SelectInput label="HTF Bias Timeframe" value={config.htfBiasTimeframe} onChange={v => onChange('htfBiasTimeframe', v)} options={[
            { value: '1W', label: 'Weekly' }, { value: '1D', label: 'Daily' }, { value: '4H', label: '4 Hour' },
          ]} />
          <SelectInput label="Entry Timeframe" value={config.entryTimeframe} onChange={v => onChange('entryTimeframe', v)} options={[
            { value: '1H', label: '1 Hour' }, { value: '15m', label: '15 Min' }, { value: '5m', label: '5 Min' }, { value: '1m', label: '1 Min' },
          ]} />
        </div>
      )}

      <SectionHeader title="Order Block Detection" collapsed={!!collapsed.ob} onToggle={() => toggle('ob')} />
      {!collapsed.ob && (
        <div className="pl-2 border-l border-zinc-700/50">
          <NumberInput label="Lookback Candles" description="How far back to search for OBs" value={config.obLookbackCandles} onChange={v => onChange('obLookbackCandles', v)} min={5} max={100} suffix="candles" />
          <NumberInput label="Min Body/Wick Ratio" description="Minimum body-to-wick ratio" value={config.obMinBodyWickRatio} onChange={v => onChange('obMinBodyWickRatio', v)} min={0.1} max={1} step={0.1} />
          <Toggle label="Must Be at Swing Point" value={config.obMustBeAtSwing} onChange={v => onChange('obMustBeAtSwing', v)} />
          <Toggle label="Invalidate on Close Through" description="Price closing through OB invalidates it" value={config.obInvalidationClose} onChange={v => onChange('obInvalidationClose', v)} />
          <SelectInput label="Mitigation Type" value={config.obMitigationType} onChange={v => onChange('obMitigationType', v)} options={[
            { value: 'touch', label: 'Touch' }, { value: '50_percent', label: '50% Penetration' }, { value: 'full_close', label: 'Full Close Through' },
          ]} />
        </div>
      )}

      <SectionHeader title="Fair Value Gap Detection" collapsed={!!collapsed.fvg} onToggle={() => toggle('fvg')} />
      {!collapsed.fvg && (
        <div className="pl-2 border-l border-zinc-700/50">
          <NumberInput label="Min FVG Size" value={config.fvgMinSizePips} onChange={v => onChange('fvgMinSizePips', v)} min={1} max={50} suffix="pips" />
          <Toggle label="Premium/Discount Only" description="Only trade FVGs in premium/discount zone" value={config.fvgPremiumDiscountOnly} onChange={v => onChange('fvgPremiumDiscountOnly', v)} />
          <NumberInput label="Fill % to Invalidate" description="How much fill invalidates the FVG" value={config.fvgFillPercentInvalidate} onChange={v => onChange('fvgFillPercentInvalidate', v)} min={25} max={100} step={25} suffix="%" />
          <Toggle label="Only Unfilled FVGs" value={config.fvgOnlyUnfilled} onChange={v => onChange('fvgOnlyUnfilled', v)} />
        </div>
      )}

      <SectionHeader title="Market Structure" collapsed={!!collapsed.structure} onToggle={() => toggle('structure')} />
      {!collapsed.structure && (
        <div className="pl-2 border-l border-zinc-700/50">
          <SelectInput label="Break Confirmation" description="How to confirm a structure break" value={config.structureBreakConfirmation} onChange={v => onChange('structureBreakConfirmation', v)} options={[
            { value: 'close', label: 'Candle Close' }, { value: 'wick', label: 'Wick Touch' },
          ]} />
          <Toggle label="CHoCH as Reversal" description="Treat Change of Character as reversal signal" value={config.chochAsReversal} onChange={v => onChange('chochAsReversal', v)} />
          <NumberInput label="Structure Lookback" value={config.structureLookback} onChange={v => onChange('structureLookback', v)} min={10} max={200} suffix="candles" />
        </div>
      )}

      <SectionHeader title="Liquidity" collapsed={!!collapsed.liquidity} onToggle={() => toggle('liquidity')} />
      {!collapsed.liquidity && (
        <div className="pl-2 border-l border-zinc-700/50">
          <Toggle label="Sweep Required Before Entry" value={config.liquiditySweepRequired} onChange={v => onChange('liquiditySweepRequired', v)} />
          <NumberInput label="Equal Highs/Lows Sensitivity" description="1=strict, 5=loose" value={config.equalHighsLowsSensitivity} onChange={v => onChange('equalHighsLowsSensitivity', v)} min={1} max={5} />
          <NumberInput label="Pool Min Touches" value={config.liquidityPoolMinTouches} onChange={v => onChange('liquidityPoolMinTouches', v)} min={2} max={5} />
        </div>
      )}

      <SectionHeader title="Premium/Discount Zone" collapsed={!!collapsed.zone} onToggle={() => toggle('zone')} />
      {!collapsed.zone && (
        <div className="pl-2 border-l border-zinc-700/50">
          <Toggle label="Enable Premium/Discount" value={config.premiumDiscountEnabled} onChange={v => onChange('premiumDiscountEnabled', v)} />
          <Toggle label="Only Buy in Discount" description="Only buy below 50% of range" value={config.onlyBuyInDiscount} onChange={v => onChange('onlyBuyInDiscount', v)} />
          <Toggle label="Only Sell in Premium" description="Only sell above 50% of range" value={config.onlySellInPremium} onChange={v => onChange('onlySellInPremium', v)} />
          <SelectInput label="Zone Method" value={config.zoneMethod} onChange={v => onChange('zoneMethod', v)} options={[
            { value: 'fibonacci', label: 'Fibonacci' }, { value: 'swing_range', label: 'Swing Range' },
          ]} />
        </div>
      )}

      <SectionHeader title="Multi-Timeframe" collapsed={!!collapsed.mtf} onToggle={() => toggle('mtf')} />
      {!collapsed.mtf && (
        <div className="pl-2 border-l border-zinc-700/50">
          <Toggle label="Require All TFs Aligned" value={config.requireAllTFAligned} onChange={v => onChange('requireAllTFAligned', v)} />
          <NumberInput label="Min TFs Aligned" value={config.minTFsAligned} onChange={v => onChange('minTFsAligned', v)} min={1} max={3} />
        </div>
      )}
    </div>
  );
}

function RiskSection({ config, onChange }: { config: any; onChange: (key: string, val: any) => void }) {
  return (
    <div className="space-y-1">
      <NumberInput label="Risk Per Trade" description="% of balance risked per trade" value={config.riskPerTrade} onChange={v => onChange('riskPerTrade', v)} min={0.1} max={10} step={0.1} suffix="%" />
      <NumberInput label="Max Daily Loss" description="Stop trading if daily loss exceeds" value={config.maxDailyLoss} onChange={v => onChange('maxDailyLoss', v)} min={1} max={20} suffix="%" />
      <NumberInput label="Max Drawdown" description="Halt bot if drawdown exceeds" value={config.maxDrawdown} onChange={v => onChange('maxDrawdown', v)} min={5} max={50} suffix="%" />
      <SelectInput label="Position Sizing Method" value={config.positionSizingMethod} onChange={v => onChange('positionSizingMethod', v)} options={[
        { value: 'percent_risk', label: '% Risk Based' }, { value: 'fixed_lots', label: 'Fixed Lots' }, { value: 'kelly', label: 'Kelly Criterion' },
      ]} />
      {config.positionSizingMethod === 'fixed_lots' && (
        <NumberInput label="Fixed Lot Size" value={config.fixedLotSize} onChange={v => onChange('fixedLotSize', v)} min={0.01} max={10} step={0.01} suffix="lots" />
      )}
      <NumberInput label="Max Open Positions" value={config.maxOpenPositions} onChange={v => onChange('maxOpenPositions', v)} min={1} max={20} />
      <NumberInput label="Max Per Symbol" description="Maximum positions per instrument" value={config.maxPositionsPerSymbol} onChange={v => onChange('maxPositionsPerSymbol', v)} min={1} max={5} />
      <NumberInput label="Max Portfolio Heat" description="Total exposure as % of balance" value={config.maxPortfolioHeat} onChange={v => onChange('maxPortfolioHeat', v)} min={1} max={30} suffix="%" />
      <NumberInput label="Min Risk:Reward" description="Only take trades with minimum R:R" value={config.minRiskReward} onChange={v => onChange('minRiskReward', v)} min={0.5} max={5} step={0.1} suffix=":1" />
    </div>
  );
}

function EntrySection({ config, onChange }: { config: any; onChange: (key: string, val: any) => void }) {
  return (
    <div className="space-y-1">
      <SelectInput label="Default Order Type" value={config.defaultOrderType} onChange={v => onChange('defaultOrderType', v)} options={[
        { value: 'market', label: 'Market' }, { value: 'limit', label: 'Limit' }, { value: 'stop', label: 'Stop' },
      ]} />
      <Toggle label="Entry Refinement" description="Enter on lower TF confirmation" value={config.entryRefinement} onChange={v => onChange('entryRefinement', v)} />
      {config.entryRefinement && (
        <SelectInput label="Refinement Timeframe" value={config.refinementTimeframe} onChange={v => onChange('refinementTimeframe', v)} options={[
          { value: '5m', label: '5 Min' }, { value: '1m', label: '1 Min' },
        ]} />
      )}
      <Toggle label="Trailing Entry" description="Trail price before entering" value={config.trailingEntry} onChange={v => onChange('trailingEntry', v)} />
      {config.trailingEntry && (
        <NumberInput label="Trail Distance" value={config.trailingEntryPips} onChange={v => onChange('trailingEntryPips', v)} min={1} max={50} suffix="pips" />
      )}
      <NumberInput label="Max Slippage" value={config.maxSlippagePips} onChange={v => onChange('maxSlippagePips', v)} min={0} max={10} suffix="pips" />
      <Toggle label="Pyramiding" description="Allow adding to winning positions" value={config.pyramidingEnabled} onChange={v => onChange('pyramidingEnabled', v)} />
      {config.pyramidingEnabled && (
        <NumberInput label="Max Pyramid Adds" value={config.maxPyramidAdds} onChange={v => onChange('maxPyramidAdds', v)} min={1} max={5} />
      )}
      <Toggle label="Close on Reverse Signal" description="Close position if opposite signal fires" value={config.closeOnReverse} onChange={v => onChange('closeOnReverse', v)} />
      <NumberInput label="Cooldown Period" description="Wait time after trade before next" value={config.cooldownMinutes} onChange={v => onChange('cooldownMinutes', v)} min={0} max={120} suffix="min" />
    </div>
  );
}

function ExitSection({ config, onChange }: { config: any; onChange: (key: string, val: any) => void }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setCollapsed(p => ({ ...p, [k]: !p[k] }));

  return (
    <div className="space-y-1">
      <SectionHeader title="Take Profit" collapsed={!!collapsed.tp} onToggle={() => toggle('tp')} />
      {!collapsed.tp && (
        <div className="pl-2 border-l border-zinc-700/50">
          <SelectInput label="TP Method" value={config.takeProfitMethod} onChange={v => onChange('takeProfitMethod', v)} options={[
            { value: 'fixed_pips', label: 'Fixed Pips' }, { value: 'rr_ratio', label: 'R:R Ratio' },
            { value: 'next_level', label: 'Next Structure Level' }, { value: 'atr_multiple', label: 'ATR Multiple' },
          ]} />
          {config.takeProfitMethod === 'fixed_pips' && <NumberInput label="Fixed TP" value={config.fixedTPPips} onChange={v => onChange('fixedTPPips', v)} min={5} max={500} suffix="pips" />}
          {config.takeProfitMethod === 'rr_ratio' && <NumberInput label="TP R:R Ratio" value={config.tpRRRatio} onChange={v => onChange('tpRRRatio', v)} min={0.5} max={10} step={0.5} suffix="R" />}
          {config.takeProfitMethod === 'atr_multiple' && <NumberInput label="ATR Multiple" value={config.tpATRMultiple} onChange={v => onChange('tpATRMultiple', v)} min={0.5} max={5} step={0.5} suffix="x ATR" />}
        </div>
      )}

      <SectionHeader title="Stop Loss" collapsed={!!collapsed.sl} onToggle={() => toggle('sl')} />
      {!collapsed.sl && (
        <div className="pl-2 border-l border-zinc-700/50">
          <SelectInput label="SL Method" value={config.stopLossMethod} onChange={v => onChange('stopLossMethod', v)} options={[
            { value: 'fixed_pips', label: 'Fixed Pips' }, { value: 'atr_based', label: 'ATR Based' },
            { value: 'structure', label: 'Below/Above Structure' }, { value: 'below_ob', label: 'Below/Above Order Block' },
          ]} />
          {config.stopLossMethod === 'fixed_pips' && <NumberInput label="Fixed SL" value={config.fixedSLPips} onChange={v => onChange('fixedSLPips', v)} min={5} max={200} suffix="pips" />}
          {config.stopLossMethod === 'atr_based' && (
            <>
              <NumberInput label="ATR Multiple" value={config.slATRMultiple} onChange={v => onChange('slATRMultiple', v)} min={0.5} max={5} step={0.5} suffix="x ATR" />
              <NumberInput label="ATR Period" value={config.slATRPeriod} onChange={v => onChange('slATRPeriod', v)} min={5} max={50} />
            </>
          )}
        </div>
      )}

      <SectionHeader title="Trailing Stop" collapsed={!!collapsed.trail} onToggle={() => toggle('trail')} />
      {!collapsed.trail && (
        <div className="pl-2 border-l border-zinc-700/50">
          <Toggle label="Enable Trailing Stop" value={config.trailingStopEnabled} onChange={v => onChange('trailingStopEnabled', v)} />
          {config.trailingStopEnabled && (
            <>
              <NumberInput label="Trail Distance" value={config.trailingStopPips} onChange={v => onChange('trailingStopPips', v)} min={1} max={100} suffix="pips" />
              <SelectInput label="Activation" value={config.trailingStopActivation} onChange={v => onChange('trailingStopActivation', v)} options={[
                { value: 'immediate', label: 'Immediately' }, { value: 'after_1r', label: 'After +1R' }, { value: 'after_breakeven', label: 'After Break-Even' },
              ]} />
            </>
          )}
        </div>
      )}

      <SectionHeader title="Partial Take Profit" collapsed={!!collapsed.partial} onToggle={() => toggle('partial')} />
      {!collapsed.partial && (
        <div className="pl-2 border-l border-zinc-700/50">
          <Toggle label="Enable Partial TP" value={config.partialTPEnabled} onChange={v => onChange('partialTPEnabled', v)} />
          {config.partialTPEnabled && (
            <>
              <NumberInput label="Close %" description="% of position to close at first target" value={config.partialTPPercent} onChange={v => onChange('partialTPPercent', v)} min={10} max={90} step={10} suffix="%" />
              <NumberInput label="At R Level" value={config.partialTPLevel} onChange={v => onChange('partialTPLevel', v)} min={0.5} max={5} step={0.5} suffix="R" />
            </>
          )}
        </div>
      )}

      <SectionHeader title="Break-Even & Time Exit" collapsed={!!collapsed.be} onToggle={() => toggle('be')} />
      {!collapsed.be && (
        <div className="pl-2 border-l border-zinc-700/50">
          <Toggle label="Break-Even Stop" description="Move SL to entry after X pips profit" value={config.breakEvenEnabled} onChange={v => onChange('breakEvenEnabled', v)} />
          {config.breakEvenEnabled && (
            <NumberInput label="Trigger Distance" value={config.breakEvenTriggerPips} onChange={v => onChange('breakEvenTriggerPips', v)} min={5} max={100} suffix="pips" />
          )}
          <Toggle label="Time-Based Exit" description="Close after max hold time" value={config.timeBasedExitEnabled} onChange={v => onChange('timeBasedExitEnabled', v)} />
          {config.timeBasedExitEnabled && (
            <NumberInput label="Max Hold Time" value={config.maxHoldHours} onChange={v => onChange('maxHoldHours', v)} min={1} max={168} suffix="hours" />
          )}
          <Toggle label="End-of-Session Close" description="Close all positions at session end" value={config.endOfSessionClose} onChange={v => onChange('endOfSessionClose', v)} />
        </div>
      )}
    </div>
  );
}

function InstrumentsSection({ config, onChange }: { config: any; onChange: (key: string, val: any) => void }) {
  const instruments = config.allowedInstruments || {};
  const toggleInstrument = (symbol: string) => {
    onChange('allowedInstruments', { ...instruments, [symbol]: !instruments[symbol] });
  };

  return (
    <div className="space-y-1">
      <div className="text-xs font-bold uppercase tracking-wider text-cyan-400 py-2 px-1">Tradeable Instruments</div>
      <div className="grid grid-cols-2 gap-1 pl-2">
        {Object.entries(instruments).map(([symbol, enabled]) => (
          <button
            key={symbol}
            onClick={() => toggleInstrument(symbol)}
            className={`flex items-center gap-2 px-3 py-2 rounded text-xs font-mono transition-colors ${
              enabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${enabled ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
            {symbol}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <Toggle label="Spread Filter" description="Skip pairs with high spread" value={config.spreadFilterEnabled} onChange={v => onChange('spreadFilterEnabled', v)} />
        {config.spreadFilterEnabled && (
          <NumberInput label="Max Spread" value={config.maxSpreadPips} onChange={v => onChange('maxSpreadPips', v)} min={0.5} max={20} step={0.5} suffix="pips" />
        )}
        <Toggle label="Volatility Filter" description="Only trade within ATR range" value={config.volatilityFilterEnabled} onChange={v => onChange('volatilityFilterEnabled', v)} />
        {config.volatilityFilterEnabled && (
          <div className="flex gap-2">
            <NumberInput label="Min ATR" value={config.minATR} onChange={v => onChange('minATR', v)} min={1} max={200} />
            <NumberInput label="Max ATR" value={config.maxATR} onChange={v => onChange('maxATR', v)} min={1} max={500} />
          </div>
        )}
        <Toggle label="Correlation Filter" description="Avoid correlated positions" value={config.correlationFilterEnabled} onChange={v => onChange('correlationFilterEnabled', v)} />
        {config.correlationFilterEnabled && (
          <NumberInput label="Max Correlation" value={config.maxCorrelation} onChange={v => onChange('maxCorrelation', v)} min={0.1} max={1} step={0.1} />
        )}
      </div>
    </div>
  );
}

function SessionsSection({ config, onChange }: { config: any; onChange: (key: string, val: any) => void }) {
  const days = config.activeDays || {};
  const toggleDay = (day: string) => {
    onChange('activeDays', { ...days, [day]: !days[day] });
  };

  return (
    <div className="space-y-1">
      <div className="text-xs font-bold uppercase tracking-wider text-cyan-400 py-2 px-1">Trading Sessions</div>

      <div className="space-y-3 pl-2">
        <div className="border border-zinc-700/50 rounded p-3">
          <Toggle label="London Session" value={config.londonEnabled} onChange={v => onChange('londonEnabled', v)} />
          {config.londonEnabled && (
            <div className="flex gap-4 mt-1">
              <TimeInput label="Start" value={config.londonStart} onChange={v => onChange('londonStart', v)} />
              <TimeInput label="End" value={config.londonEnd} onChange={v => onChange('londonEnd', v)} />
            </div>
          )}
        </div>

        <div className="border border-zinc-700/50 rounded p-3">
          <Toggle label="New York Session" value={config.newYorkEnabled} onChange={v => onChange('newYorkEnabled', v)} />
          {config.newYorkEnabled && (
            <div className="flex gap-4 mt-1">
              <TimeInput label="Start" value={config.newYorkStart} onChange={v => onChange('newYorkStart', v)} />
              <TimeInput label="End" value={config.newYorkEnd} onChange={v => onChange('newYorkEnd', v)} />
            </div>
          )}
        </div>

        <div className="border border-zinc-700/50 rounded p-3">
          <Toggle label="Asian Session" value={config.asianEnabled} onChange={v => onChange('asianEnabled', v)} />
          {config.asianEnabled && (
            <div className="flex gap-4 mt-1">
              <TimeInput label="Start" value={config.asianStart} onChange={v => onChange('asianStart', v)} />
              <TimeInput label="End" value={config.asianEnd} onChange={v => onChange('asianEnd', v)} />
            </div>
          )}
        </div>

        <div className="border border-zinc-700/50 rounded p-3">
          <Toggle label="Sydney Session" value={config.sydneyEnabled} onChange={v => onChange('sydneyEnabled', v)} />
          {config.sydneyEnabled && (
            <div className="flex gap-4 mt-1">
              <TimeInput label="Start" value={config.sydneyStart} onChange={v => onChange('sydneyStart', v)} />
              <TimeInput label="End" value={config.sydneyEnd} onChange={v => onChange('sydneyEnd', v)} />
            </div>
          )}
        </div>
      </div>

      <div className="text-xs font-bold uppercase tracking-wider text-cyan-400 py-2 px-1 mt-4">Active Days</div>
      <div className="flex gap-1 pl-2">
        {['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map(day => (
          <button
            key={day}
            onClick={() => toggleDay(day)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              days[day] ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
            }`}
          >
            {day.slice(0, 3).toUpperCase()}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <Toggle label="News Filter" description="Pause before/after high-impact news" value={config.newsFilterEnabled} onChange={v => onChange('newsFilterEnabled', v)} />
        {config.newsFilterEnabled && (
          <NumberInput label="Pause Duration" description="Minutes to pause before and after news" value={config.newsFilterPauseMinutes} onChange={v => onChange('newsFilterPauseMinutes', v)} min={5} max={120} suffix="min" />
        )}
      </div>
    </div>
  );
}

function NotificationsSection({ config, onChange }: { config: any; onChange: (key: string, val: any) => void }) {
  return (
    <div className="space-y-1">
      <Toggle label="Notify on Trade" description="Alert when trade opened/closed" value={config.notifyOnTrade} onChange={v => onChange('notifyOnTrade', v)} />
      <Toggle label="Notify on Signal" description="Alert when signal detected" value={config.notifyOnSignal} onChange={v => onChange('notifyOnSignal', v)} />
      <Toggle label="Notify on Error" description="Alert on execution errors" value={config.notifyOnError} onChange={v => onChange('notifyOnError', v)} />
      <Toggle label="Daily Summary" description="Send daily P&L report" value={config.notifyDailySummary} onChange={v => onChange('notifyDailySummary', v)} />
      <SelectInput label="Notification Channel" value={config.notifyChannel} onChange={v => onChange('notifyChannel', v)} options={[
        { value: 'in_app', label: 'In-App' }, { value: 'telegram', label: 'Telegram' }, { value: 'email', label: 'Email' },
      ]} />
    </div>
  );
}

function ProtectionSection({ config, onChange }: { config: any; onChange: (key: string, val: any) => void }) {
  return (
    <div className="space-y-1">
      <NumberInput label="Daily Profit Target" description="Stop after hitting daily profit (0=disabled)" value={config.dailyProfitTarget} onChange={v => onChange('dailyProfitTarget', v)} min={0} max={100000} suffix="$" />
      <NumberInput label="Daily Loss Limit" description="Stop after hitting daily loss (0=disabled)" value={config.dailyLossLimit} onChange={v => onChange('dailyLossLimit', v)} min={0} max={100000} suffix="$" />
      <NumberInput label="Cumulative Profit Target" description="Stop after total profit (0=disabled)" value={config.cumulativeProfitTarget} onChange={v => onChange('cumulativeProfitTarget', v)} min={0} max={1000000} suffix="$" />
      <NumberInput label="Cumulative Loss Limit" description="Stop after total loss (0=disabled)" value={config.cumulativeLossLimit} onChange={v => onChange('cumulativeLossLimit', v)} min={0} max={1000000} suffix="$" />
      <Toggle label="Halt on Daily Target" description="Stop bot when daily profit target hit" value={config.haltOnDailyTarget} onChange={v => onChange('haltOnDailyTarget', v)} />
      <Toggle label="Halt on Daily Loss" description="Stop bot when daily loss limit hit" value={config.haltOnDailyLoss} onChange={v => onChange('haltOnDailyLoss', v)} />
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────

export default function BotConfigPanel({ onClose }: { onClose: () => void }) {
  const [activeSection, setActiveSection] = useState<ConfigSection>('strategy');
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: config, refetch } = trpc.botConfig.get.useQuery();
  const updateMutation = trpc.botConfig.update.useMutation({
    onSuccess: () => {
      refetch();
      setHasChanges(false);
      setSaving(false);
    },
  });
  const resetMutation = trpc.botConfig.reset.useMutation({
    onSuccess: () => {
      refetch();
      setHasChanges(false);
    },
  });

  // Local state mirrors server config for editing
  const [localConfig, setLocalConfig] = useState<any>(null);

  useEffect(() => {
    if (config) {
      setLocalConfig(JSON.parse(JSON.stringify(config)));
    }
  }, [config]);

  const handleChange = useCallback((section: ConfigSection, key: string, value: any) => {
    setLocalConfig((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        [section]: { ...prev[section], [key]: value },
      };
    });
    setHasChanges(true);
  }, []);

  const handleSave = () => {
    if (!localConfig) return;
    setSaving(true);
    updateMutation.mutate(localConfig);
  };

  const handleReset = () => {
    if (confirm('Reset all bot configuration to defaults?')) {
      resetMutation.mutate();
    }
  };

  if (!localConfig) {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
        <div className="bg-zinc-900 rounded-lg p-8 text-muted-foreground">Loading configuration...</div>
      </div>
    );
  }

  const sectionConfig = localConfig[activeSection];

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700">
          <div className="flex items-center gap-3">
            <Settings2 className="text-cyan-400" size={20} />
            <h2 className="text-lg font-bold text-foreground">Bot Configuration</h2>
            {hasChanges && <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">Unsaved changes</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-muted-foreground rounded transition-colors">
              <RotateCcw size={12} /> Reset Defaults
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-xs rounded font-medium transition-colors ${
                hasChanges ? 'bg-cyan-500 hover:bg-cyan-600 text-black' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              }`}
            >
              <Save size={12} /> {saving ? 'Saving...' : 'Save Config'}
            </button>
            <button onClick={onClose} className="ml-2 text-muted-foreground hover:text-foreground text-lg">&times;</button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-56 border-r border-zinc-700 py-2 overflow-y-auto shrink-0">
            {SECTION_META.map(s => (
              <button
                key={s.key}
                onClick={() => setActiveSection(s.key)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  activeSection === s.key
                    ? 'bg-cyan-500/10 text-cyan-400 border-r-2 border-cyan-400'
                    : 'text-muted-foreground hover:bg-zinc-800 hover:text-foreground'
                }`}
              >
                {s.icon}
                <div>
                  <div className="text-sm font-medium">{s.label}</div>
                  <div className="text-[10px] text-muted-foreground">{s.description}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeSection === 'strategy' && <StrategySection config={sectionConfig} onChange={(k, v) => handleChange('strategy', k, v)} />}
            {activeSection === 'risk' && <RiskSection config={sectionConfig} onChange={(k, v) => handleChange('risk', k, v)} />}
            {activeSection === 'entry' && <EntrySection config={sectionConfig} onChange={(k, v) => handleChange('entry', k, v)} />}
            {activeSection === 'exit' && <ExitSection config={sectionConfig} onChange={(k, v) => handleChange('exit', k, v)} />}
            {activeSection === 'instruments' && <InstrumentsSection config={sectionConfig} onChange={(k, v) => handleChange('instruments', k, v)} />}
            {activeSection === 'sessions' && <SessionsSection config={sectionConfig} onChange={(k, v) => handleChange('sessions', k, v)} />}
            {activeSection === 'notifications' && <NotificationsSection config={sectionConfig} onChange={(k, v) => handleChange('notifications', k, v)} />}
            {activeSection === 'protection' && <ProtectionSection config={sectionConfig} onChange={(k, v) => handleChange('protection', k, v)} />}
          </div>
        </div>
      </div>
    </div>
  );
}
