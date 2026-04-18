/**
 * FOTSI Bot #2 Configuration Panel
 * 
 * Settings for the FOTSI Mean Reversion strategy:
 * - Divergence & Hook settings
 * - Risk management
 * - SL/TP methods
 * - Session filters
 */
import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';

// ─── Reusable Controls ─────────────────────────────────────────────

function Toggle({ label, value, onChange, description }: {
  label: string; value: boolean; onChange: (v: boolean) => void; description?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div>
        <span className="text-xs text-zinc-200">{label}</span>
        {description && <p className="text-[10px] text-zinc-500 mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`w-9 h-5 rounded-full transition-colors ${value ? 'bg-cyan-500' : 'bg-zinc-700'} relative`}
      >
        <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${value ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

function NumberInput({ label, value, onChange, min, max, step, unit, description }: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; unit?: string; description?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div>
        <span className="text-xs text-zinc-200">{label}</span>
        {description && <p className="text-[10px] text-zinc-500 mt-0.5">{description}</p>}
      </div>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          min={min} max={max} step={step || 1}
          className="w-20 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-200 font-mono text-right focus:border-cyan-500 focus:outline-none"
        />
        {unit && <span className="text-[10px] text-zinc-500 w-6">{unit}</span>}
      </div>
    </div>
  );
}

function SelectInput({ label, value, onChange, options, description }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; description?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div>
        <span className="text-xs text-zinc-200">{label}</span>
        {description && <p className="text-[10px] text-zinc-500 mt-0.5">{description}</p>}
      </div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-200 font-mono focus:border-cyan-500 focus:outline-none"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="pt-4 pb-2 border-b border-zinc-800 mb-2">
      <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400">{title}</h3>
    </div>
  );
}

// ─── Config Panel ──────────────────────────────────────────────────

interface FOTSIConfigPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function FOTSIConfigPanel({ open, onClose }: FOTSIConfigPanelProps) {
  const configQuery = trpc.fotsi.config.get.useQuery(undefined, { enabled: open });
  const updateMut = trpc.fotsi.config.update.useMutation({ onSuccess: () => configQuery.refetch() });
  const resetMut = trpc.fotsi.config.reset.useMutation({ onSuccess: () => configQuery.refetch() });

  const [local, setLocal] = useState<any>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<'divergence' | 'risk' | 'sltp' | 'sessions'>('divergence');

  useEffect(() => {
    if (configQuery.data) {
      setLocal({ ...configQuery.data });
      setHasChanges(false);
    }
  }, [configQuery.data]);

  if (!open) return null;

  const update = (key: string, value: any) => {
    setLocal((prev: any) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const updateSession = (key: string, value: boolean) => {
    setLocal((prev: any) => ({
      ...prev,
      sessions: { ...prev.sessions, [key]: value },
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    if (local) {
      updateMut.mutate(local);
      setHasChanges(false);
    }
  };

  const handleReset = () => {
    resetMut.mutate();
    setHasChanges(false);
  };

  const tabs = [
    { id: 'divergence' as const, label: 'Divergence' },
    { id: 'risk' as const, label: 'Risk' },
    { id: 'sltp' as const, label: 'SL/TP' },
    { id: 'sessions' as const, label: 'Sessions' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-xl w-[520px] max-h-[80vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Bot #2 — FOTSI Config</h2>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <span className="text-[10px] text-amber-400 font-mono">UNSAVED</span>
            )}
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 text-lg leading-none">×</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 px-2">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 text-xs font-mono uppercase tracking-wider transition ${
                activeTab === t.id
                  ? 'text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-2">
          {!local ? (
            <div className="py-8 text-center text-zinc-500 text-xs font-mono">Loading config...</div>
          ) : (
            <>
              {activeTab === 'divergence' && (
                <>
                  <SectionHeader title="FOTSI Divergence Settings" />
                  <Toggle
                    label="Bot #2 Enabled"
                    value={local.enabled}
                    onChange={v => update('enabled', v)}
                    description="Enable FOTSI Mean Reversion scanning"
                  />
                  <NumberInput
                    label="Min Divergence Spread"
                    value={local.minDivergenceSpread}
                    onChange={v => update('minDivergenceSpread', v)}
                    min={10} max={100} step={5}
                    description="Minimum TSI spread between base/quote currencies"
                  />
                  <Toggle
                    label="Hook Required"
                    value={local.hookRequired}
                    onChange={v => update('hookRequired', v)}
                    description="Require TSI hook (reversal signal) before entry"
                  />
                  <NumberInput
                    label="Hook Lookback Bars"
                    value={local.hookBars}
                    onChange={v => update('hookBars', v)}
                    min={2} max={10}
                    description="Number of bars to detect hook pattern"
                  />
                  <NumberInput
                    label="Min Extreme Level"
                    value={local.minExtremeLevel}
                    onChange={v => update('minExtremeLevel', v)}
                    min={10} max={80}
                    description="Minimum |TSI| for OB/OS zone entry"
                  />
                  <SelectInput
                    label="Entry Timeframe"
                    value={local.entryTimeframe}
                    onChange={v => update('entryTimeframe', v)}
                    options={[
                      { value: '1h', label: '1 Hour' },
                      { value: '4h', label: '4 Hour' },
                    ]}
                    description="Timeframe for entry signal detection"
                  />
                </>
              )}

              {activeTab === 'risk' && (
                <>
                  <SectionHeader title="Risk Management" />
                  <NumberInput
                    label="Risk Per Trade"
                    value={local.riskPerTrade}
                    onChange={v => update('riskPerTrade', v)}
                    min={0.1} max={5} step={0.1} unit="%"
                    description="Percentage of account risked per trade"
                  />
                  <NumberInput
                    label="Max Concurrent Positions"
                    value={local.maxConcurrent}
                    onChange={v => update('maxConcurrent', v)}
                    min={1} max={10}
                    description="Maximum simultaneous open positions"
                  />
                  <NumberInput
                    label="Cooldown Period"
                    value={local.cooldownMinutes}
                    onChange={v => update('cooldownMinutes', v)}
                    min={0} max={1440} step={30} unit="min"
                    description="Wait time between trades on same pair"
                  />
                  <NumberInput
                    label="Max Daily Loss"
                    value={local.maxDailyLoss}
                    onChange={v => update('maxDailyLoss', v)}
                    min={0.5} max={10} step={0.5} unit="%"
                    description="Stop trading if daily loss exceeds this"
                  />
                  <NumberInput
                    label="Max Daily Trades"
                    value={local.maxDailyTrades}
                    onChange={v => update('maxDailyTrades', v)}
                    min={1} max={20}
                    description="Maximum number of trades per day"
                  />
                  <NumberInput
                    label="Min R:R Ratio"
                    value={local.minRR}
                    onChange={v => update('minRR', v)}
                    min={1} max={10} step={0.5}
                    description="Minimum risk-reward ratio to accept trade"
                  />
                </>
              )}

              {activeTab === 'sltp' && (
                <>
                  <SectionHeader title="Stop Loss" />
                  <SelectInput
                    label="SL Method"
                    value={local.slMethod}
                    onChange={v => update('slMethod', v)}
                    options={[
                      { value: 'atr', label: 'ATR-Based' },
                      { value: 'structure', label: 'Structure (Swing H/L)' },
                      { value: 'fixed', label: 'Fixed Pips' },
                    ]}
                  />
                  {local.slMethod === 'atr' && (
                    <NumberInput
                      label="ATR Multiplier"
                      value={local.slATRMultiplier}
                      onChange={v => update('slATRMultiplier', v)}
                      min={0.5} max={5} step={0.5}
                      description="SL = ATR × multiplier"
                    />
                  )}
                  {local.slMethod === 'fixed' && (
                    <NumberInput
                      label="Fixed SL"
                      value={local.slFixedPips}
                      onChange={v => update('slFixedPips', v)}
                      min={10} max={200} unit="pips"
                    />
                  )}

                  <SectionHeader title="Take Profit" />
                  <SelectInput
                    label="TP1 Method"
                    value={local.tp1Method}
                    onChange={v => update('tp1Method', v)}
                    options={[
                      { value: 'ema50', label: 'EMA 50 (Dynamic)' },
                      { value: 'fixed_rr', label: 'Fixed R:R' },
                    ]}
                    description="First take profit target"
                  />
                  {local.tp1Method === 'fixed_rr' && (
                    <NumberInput
                      label="TP1 R:R"
                      value={local.tp1RR}
                      onChange={v => update('tp1RR', v)}
                      min={0.5} max={5} step={0.5}
                    />
                  )}
                  <SelectInput
                    label="TP2 Method"
                    value={local.tp2Method}
                    onChange={v => update('tp2Method', v)}
                    options={[
                      { value: 'ema100', label: 'EMA 100 (Dynamic)' },
                      { value: 'fixed_rr', label: 'Fixed R:R' },
                    ]}
                    description="Second take profit target (remainder)"
                  />
                  {local.tp2Method === 'fixed_rr' && (
                    <NumberInput
                      label="TP2 R:R"
                      value={local.tp2RR}
                      onChange={v => update('tp2RR', v)}
                      min={1} max={10} step={0.5}
                    />
                  )}

                  <SectionHeader title="Position Management" />
                  <NumberInput
                    label="Partial Close at TP1"
                    value={local.partialClosePercent}
                    onChange={v => update('partialClosePercent', v)}
                    min={10} max={90} step={10} unit="%"
                    description="Percentage of position to close at TP1"
                  />
                  <Toggle
                    label="Break-Even After TP1"
                    value={local.breakEvenAfterTP1}
                    onChange={v => update('breakEvenAfterTP1', v)}
                    description="Move SL to entry after TP1 is hit"
                  />
                  <NumberInput
                    label="Max Hold Time"
                    value={local.maxHoldHours}
                    onChange={v => update('maxHoldHours', v)}
                    min={1} max={168} step={1} unit="hrs"
                    description="Auto-close if position exceeds this duration"
                  />
                </>
              )}

              {activeTab === 'sessions' && (
                <>
                  <SectionHeader title="Trading Sessions" />
                  <Toggle
                    label="London Session"
                    value={local.sessions.london}
                    onChange={v => updateSession('london', v)}
                    description="07:00 - 16:00 UTC"
                  />
                  <Toggle
                    label="New York Session"
                    value={local.sessions.newYork}
                    onChange={v => updateSession('newYork', v)}
                    description="12:00 - 21:00 UTC"
                  />
                  <Toggle
                    label="Asian Session"
                    value={local.sessions.asian}
                    onChange={v => updateSession('asian', v)}
                    description="00:00 - 09:00 UTC"
                  />
                  <Toggle
                    label="Sydney Session"
                    value={local.sessions.sydney}
                    onChange={v => updateSession('sydney', v)}
                    description="22:00 - 07:00 UTC"
                  />
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-800">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-xs font-mono text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 rounded transition"
          >
            Reset Defaults
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-mono text-zinc-400 hover:text-zinc-200 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || updateMut.isPending}
              className="px-5 py-2 text-xs font-mono font-bold text-white bg-cyan-600 hover:bg-cyan-500 rounded transition disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
            >
              {updateMut.isPending ? 'Saving...' : 'Save Config'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
