/**
 * WatchlistPanel — Setup Staging / Watchlist UI
 * 
 * Shows setups the bot is "watching" — scored above the watch threshold
 * but below the trade gate. Displays progress toward promotion,
 * missing factors, TTL countdown, and allows manual dismissal.
 */
import { useState } from 'react';
import { trpc } from '@/lib/trpc';

// ─── Helpers ──────────────────────────────────────────────────────

function timeAgo(ms: number): string {
  const elapsed = Date.now() - ms;
  if (elapsed < 60_000) return `${Math.floor(elapsed / 1000)}s ago`;
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  return `${Math.floor(elapsed / 3_600_000)}h ${Math.floor((elapsed % 3_600_000) / 60_000)}m ago`;
}

function ttlRemaining(stagedAt: number, ttlMinutes: number): { text: string; pct: number; urgent: boolean } {
  const elapsed = (Date.now() - stagedAt) / 60_000;
  const remaining = Math.max(0, ttlMinutes - elapsed);
  const pct = Math.max(0, Math.min(100, (remaining / ttlMinutes) * 100));
  const urgent = remaining < ttlMinutes * 0.2;
  if (remaining < 1) return { text: 'Expiring...', pct: 0, urgent: true };
  if (remaining < 60) return { text: `${Math.ceil(remaining)}m left`, pct, urgent };
  return { text: `${Math.floor(remaining / 60)}h ${Math.ceil(remaining % 60)}m left`, pct, urgent };
}

function scorePct(score: number, gate: number): number {
  return Math.min(100, Math.round((score / gate) * 100));
}

// ─── Component ────────────────────────────────────────────────────

interface WatchlistPanelProps {
  confluenceGate?: number;
}

export default function WatchlistPanel({ confluenceGate = 6 }: WatchlistPanelProps) {
  const [showHistory, setShowHistory] = useState(false);

  const activeSetups = trpc.engine.stagedSetups.useQuery(undefined, {
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const allSetups = trpc.engine.allStagedSetups.useQuery(undefined, {
    refetchInterval: 30_000,
    staleTime: 15_000,
    enabled: showHistory,
  });

  const dismissMut = trpc.engine.dismissStaged.useMutation({
    onSuccess: () => activeSetups.refetch(),
  });

  const active = activeSetups.data || [];
  const history = (allSetups.data || []).filter(s => s.status !== 'watching');

  return (
    <div className="p-2 md:p-3 border-b border-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <h3 className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-foreground">
            Watching
          </h3>
          {active.length > 0 && (
            <span className="text-[9px] font-mono bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">
              {active.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="text-[9px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {showHistory ? 'Hide History' : 'History'}
        </button>
      </div>

      {/* Active Staged Setups */}
      {active.length === 0 ? (
        <div className="text-[10px] text-muted-foreground text-center py-3 border border-dashed border-border/50 rounded">
          No setups building. The bot will stage setups that score between the watch threshold and trade gate.
        </div>
      ) : (
        <div className="space-y-2">
          {active.map(setup => {
            const ttl = ttlRemaining(setup.stagedAt, setup.ttlMinutes);
            const progress = scorePct(setup.currentScore, setup.gateThreshold);
            const cycleProgress = Math.min(100, Math.round((setup.scanCycles / setup.minCycles) * 100));

            return (
              <div
                key={setup.id}
                className="bg-card/60 border border-amber-500/30 rounded-lg p-2.5 relative overflow-hidden"
              >
                {/* TTL bar background */}
                <div
                  className={`absolute bottom-0 left-0 h-0.5 transition-all duration-1000 ${
                    ttl.urgent ? 'bg-red-500/60' : 'bg-amber-500/30'
                  }`}
                  style={{ width: `${ttl.pct}%` }}
                />

                {/* Row 1: Symbol + Direction + Score */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-foreground">{setup.symbol}</span>
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      setup.direction === 'long'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}>
                      {setup.direction}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold font-mono ${
                      progress >= 80 ? 'text-emerald-400' : progress >= 60 ? 'text-yellow-400' : 'text-muted-foreground'
                    }`}>
                      {setup.currentScore}/10
                    </span>
                    <button
                      onClick={() => dismissMut.mutate({ setupId: setup.id })}
                      disabled={dismissMut.isPending}
                      className="text-muted-foreground hover:text-red-400 transition-colors p-0.5"
                      title="Dismiss this setup"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Row 2: Score progress bar */}
                <div className="mb-1.5">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[8px] text-muted-foreground uppercase">Score Progress</span>
                    <span className="text-[8px] text-muted-foreground">{progress}% to gate ({setup.gateThreshold})</span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        progress >= 80 ? 'bg-emerald-500' : progress >= 60 ? 'bg-yellow-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Row 3: Factors present */}
                {setup.currentFactors && setup.currentFactors.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {setup.currentFactors.map((f: any, i: number) => (
                      <span
                        key={i}
                        className="px-1 py-0.5 bg-cyan-500/10 text-cyan-400 text-[8px] border border-cyan-500/20 rounded"
                        title={f.detail}
                      >
                        {f.concept}
                      </span>
                    ))}
                  </div>
                )}

                {/* Row 4: Missing factors */}
                {setup.missingFactors && setup.missingFactors.length > 0 && (
                  <div className="mb-1.5">
                    <span className="text-[8px] text-muted-foreground uppercase">Missing: </span>
                    {setup.missingFactors.map((f: any, i: number) => (
                      <span
                        key={i}
                        className="text-[8px] text-red-400/70 mr-1"
                        title={f.detail}
                      >
                        {f.concept}{i < setup.missingFactors.length - 1 ? ',' : ''}
                      </span>
                    ))}
                  </div>
                )}

                {/* Row 5: Meta info */}
                <div className="flex items-center justify-between text-[8px] text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span>Cycle {setup.scanCycles}/{setup.minCycles}</span>
                    <span>·</span>
                    <span>T1: {setup.tier1Count} T2: {setup.tier2Count}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={ttl.urgent ? 'text-red-400' : ''}>{ttl.text}</span>
                    <span>·</span>
                    <span>Staged {timeAgo(setup.stagedAt)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* History Section */}
      {showHistory && history.length > 0 && (
        <div className="mt-3 pt-2 border-t border-border/50">
          <h4 className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
            Recent History ({history.length})
          </h4>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {history.slice(0, 20).map(setup => (
              <div
                key={setup.id}
                className={`flex items-center justify-between py-1 px-1.5 rounded text-[9px] ${
                  setup.status === 'promoted'
                    ? 'bg-emerald-500/10 border border-emerald-500/20'
                    : setup.status === 'expired'
                    ? 'bg-zinc-700/30 border border-zinc-600/20'
                    : 'bg-red-500/10 border border-red-500/20'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`font-bold uppercase ${
                    setup.status === 'promoted' ? 'text-emerald-400' :
                    setup.status === 'expired' ? 'text-zinc-400' : 'text-red-400'
                  }`}>
                    {setup.status === 'promoted' ? '✓' : setup.status === 'expired' ? '⏱' : '✗'}
                  </span>
                  <span className="font-mono text-foreground">{setup.symbol}</span>
                  <span className={setup.direction === 'long' ? 'text-emerald-400' : 'text-red-400'}>
                    {setup.direction}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <span>{setup.currentScore}/10</span>
                  <span>·</span>
                  <span>{setup.scanCycles} cycles</span>
                  {setup.resolvedAt && (
                    <>
                      <span>·</span>
                      <span>{timeAgo(setup.resolvedAt)}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
