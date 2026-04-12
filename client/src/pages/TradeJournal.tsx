/**
 * Trade Journal — Full trade logging, review, and statistics page.
 * Design: Obsidian Forge — Dark Brutalist Trading Interface
 */

import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

import { toast } from "sonner";
import {
  Zap, ArrowLeft, Plus, X, TrendingUp, TrendingDown, Target,
  Trophy, BarChart3, CheckCircle, XCircle, Edit2, Trash2, BookOpen,
  Filter, ChevronDown, ChevronUp, Image as ImageIcon
} from "lucide-react";
import EquityCurve from "@/components/EquityCurve";
import ScreenshotCapture from "@/components/ScreenshotCapture";

type TradeDirection = "long" | "short";
type TradeStatus = "open" | "closed" | "cancelled";

const SETUP_TYPES = [
  "OB Retest",
  "FVG Entry",
  "Liquidity Sweep",
  "BOS Continuation",
  "CHoCH Reversal",
  "50% Retracement",
  "Trend Line Break",
  "Other",
];

const SYMBOLS = [
  "EUR/USD", "GBP/USD", "USD/JPY", "GBP/JPY", "AUD/USD",
  "USD/CAD", "EUR/GBP", "NZD/USD", "BTC/USD", "XAU/USD", "XAG/USD",
];

const TIMEFRAMES = ["1W", "1D", "4H", "1H", "15M", "5M"];

interface TradeFormData {
  symbol: string;
  direction: TradeDirection;
  status: TradeStatus;
  entryPrice: string;
  exitPrice: string;
  stopLoss: string;
  takeProfit: string;
  positionSize: string;
  riskReward: string;
  riskPercent: string;
  pnlPips: string;
  pnlAmount: string;
  timeframe: string;
  followedStrategy: boolean;
  setupType: string;
  notes: string;
  deviations: string;
  improvements: string;
  entryTime: string;
  exitTime: string;
  screenshotUrl: string;
}

const emptyForm: TradeFormData = {
  symbol: "EUR/USD",
  direction: "long",
  status: "open",
  entryPrice: "",
  exitPrice: "",
  stopLoss: "",
  takeProfit: "",
  positionSize: "",
  riskReward: "",
  riskPercent: "",
  pnlPips: "",
  pnlAmount: "",
  timeframe: "4H",
  followedStrategy: true,
  setupType: "",
  notes: "",
  deviations: "",
  improvements: "",
  entryTime: new Date().toISOString().slice(0, 16),
  exitTime: "",
  screenshotUrl: "",
};

export default function TradeJournal() {
  const [, setLocation] = useLocation();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TradeFormData>(emptyForm);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSymbol, setFilterSymbol] = useState<string>("all");
  const [expandedTrade, setExpandedTrade] = useState<number | null>(null);

  // tRPC queries
  const tradesQuery = trpc.trades.list.useQuery(
    { limit: 100, offset: 0 },
  );
  const statsQuery = trpc.trades.stats.useQuery();

  const utils = trpc.useUtils();

  const createMutation = trpc.trades.create.useMutation({
    onSuccess: () => {
      toast.success("Trade logged successfully");
      utils.trades.list.invalidate();
      utils.trades.stats.invalidate();
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.trades.update.useMutation({
    onSuccess: () => {
      toast.success("Trade updated");
      utils.trades.list.invalidate();
      utils.trades.stats.invalidate();
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.trades.delete.useMutation({
    onSuccess: () => {
      toast.success("Trade deleted");
      utils.trades.list.invalidate();
      utils.trades.stats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const resetForm = () => {
    setForm(emptyForm);
    setShowForm(false);
    setEditingId(null);
  };

  const handleSubmit = () => {
    if (!form.entryPrice || !form.entryTime) {
      toast.error("Entry price and time are required");
      return;
    }

    const payload = {
      symbol: form.symbol,
      direction: form.direction as TradeDirection,
      status: form.status as TradeStatus,
      entryPrice: form.entryPrice,
      exitPrice: form.exitPrice || undefined,
      stopLoss: form.stopLoss || undefined,
      takeProfit: form.takeProfit || undefined,
      positionSize: form.positionSize || undefined,
      riskReward: form.riskReward || undefined,
      riskPercent: form.riskPercent || undefined,
      pnlPips: form.pnlPips || undefined,
      pnlAmount: form.pnlAmount || undefined,
      timeframe: form.timeframe || undefined,
      followedStrategy: form.followedStrategy,
      setupType: form.setupType || undefined,
      notes: form.notes || undefined,
      deviations: form.deviations || undefined,
      improvements: form.improvements || undefined,
      screenshotUrl: form.screenshotUrl || undefined,
      entryTime: new Date(form.entryTime),
      exitTime: form.exitTime ? new Date(form.exitTime) : undefined,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (trade: any) => {
    setForm({
      symbol: trade.symbol,
      direction: trade.direction,
      status: trade.status,
      entryPrice: trade.entryPrice || "",
      exitPrice: trade.exitPrice || "",
      stopLoss: trade.stopLoss || "",
      takeProfit: trade.takeProfit || "",
      positionSize: trade.positionSize || "",
      riskReward: trade.riskReward || "",
      riskPercent: trade.riskPercent || "",
      pnlPips: trade.pnlPips || "",
      pnlAmount: trade.pnlAmount || "",
      timeframe: trade.timeframe || "4H",
      followedStrategy: trade.followedStrategy ?? true,
      setupType: trade.setupType || "",
      notes: trade.notes || "",
      deviations: trade.deviations || "",
      improvements: trade.improvements || "",
      entryTime: trade.entryTime ? new Date(trade.entryTime).toISOString().slice(0, 16) : "",
      exitTime: trade.exitTime ? new Date(trade.exitTime).toISOString().slice(0, 16) : "",
      screenshotUrl: trade.screenshotUrl || "",
    });
    setEditingId(trade.id);
    setShowForm(true);
  };

  const filteredTrades = useMemo(() => {
    if (!tradesQuery.data) return [];
    return tradesQuery.data.filter((t) => {
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterSymbol !== "all" && t.symbol !== filterSymbol) return false;
      return true;
    });
  }, [tradesQuery.data, filterStatus, filterSymbol]);

  const stats = statsQuery.data;



  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* HEADER */}
      <header className="border-b-4 border-border bg-card px-4 lg:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setLocation("/")}
            className="text-muted-foreground hover:text-cyan transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-cyan" />
            <h1 className="text-sm lg:text-base font-bold uppercase tracking-[0.1em] text-foreground font-mono">
              Trade Journal
            </h1>
          </div>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-bold text-xs uppercase tracking-wider hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Log Trade
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* STATS CARDS */}
        {stats && (
          <div className="px-4 lg:px-6 py-4 border-b-4 border-border bg-card/50">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              <StatCard
                label="Win Rate"
                value={`${stats.winRate.toFixed(1)}%`}
                icon={<Trophy className="w-4 h-4" />}
                color={stats.winRate >= 50 ? "text-bullish" : "text-bearish"}
              />
              <StatCard
                label="Total P&L"
                value={`$${stats.totalPnl.toFixed(2)}`}
                icon={<BarChart3 className="w-4 h-4" />}
                color={stats.totalPnl >= 0 ? "text-bullish" : "text-bearish"}
              />
              <StatCard
                label="Total Pips"
                value={stats.totalPips.toFixed(1)}
                icon={<Target className="w-4 h-4" />}
                color={stats.totalPips >= 0 ? "text-bullish" : "text-bearish"}
              />
              <StatCard
                label="Avg R:R"
                value={stats.avgRR.toFixed(2)}
                icon={<TrendingUp className="w-4 h-4" />}
                color="text-cyan"
              />
              <StatCard
                label="Strategy Adherence"
                value={`${stats.strategyAdherence.toFixed(0)}%`}
                icon={<CheckCircle className="w-4 h-4" />}
                color={stats.strategyAdherence >= 80 ? "text-bullish" : "text-warning"}
              />
            </div>
            <div className="flex gap-4 mt-3 text-[10px] font-mono text-muted-foreground">
              <span>Trades: <span className="text-foreground">{stats.totalTrades}</span></span>
              <span>Wins: <span className="text-bullish">{stats.wins}</span></span>
              <span>Losses: <span className="text-bearish">{stats.losses}</span></span>
              <span>BE: <span className="text-foreground">{stats.breakeven}</span></span>
            </div>
          </div>
        )}

        {/* EQUITY CURVE */}
        <div className="px-4 lg:px-6 py-4 border-b-4 border-border">
          <EquityCurve />
        </div>

        {/* FILTERS */}
        <div className="px-4 lg:px-6 py-3 border-b border-border/50 flex items-center gap-3 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-muted text-foreground text-xs font-mono px-3 py-1.5 border border-border outline-none focus:border-cyan"
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            value={filterSymbol}
            onChange={(e) => setFilterSymbol(e.target.value)}
            className="bg-muted text-foreground text-xs font-mono px-3 py-1.5 border border-border outline-none focus:border-cyan"
          >
            <option value="all">All Symbols</option>
            {SYMBOLS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <span className="text-[10px] text-muted-foreground font-mono ml-auto">
            {filteredTrades.length} trade{filteredTrades.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* TRADE LIST */}
        <div className="px-4 lg:px-6 py-4">
          {tradesQuery.isLoading ? (
            <div className="text-center py-12">
              <Zap className="w-6 h-6 text-cyan animate-pulse mx-auto mb-2" />
              <p className="text-muted-foreground font-mono text-xs">Loading trades...</p>
            </div>
          ) : filteredTrades.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-mono text-sm mb-1">No trades yet</p>
              <p className="text-muted-foreground/60 font-mono text-xs">Click "Log Trade" to record your first trade</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTrades.map((trade) => (
                <TradeRow
                  key={trade.id}
                  trade={trade}
                  expanded={expandedTrade === trade.id}
                  onToggle={() => setExpandedTrade(expandedTrade === trade.id ? null : trade.id)}
                  onEdit={() => handleEdit(trade)}
                  onDelete={() => {
                    if (confirm("Delete this trade?")) {
                      deleteMutation.mutate({ id: trade.id });
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* TRADE FORM MODAL */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={resetForm} />
          <div className="relative bg-card border-4 border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
            {/* Form Header */}
            <div className="px-6 py-4 border-b-4 border-border flex items-center justify-between sticky top-0 bg-card z-10">
              <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-foreground font-mono">
                {editingId ? "Edit Trade" : "Log New Trade"}
              </h2>
              <button onClick={resetForm} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Row 1: Symbol, Direction, Status */}
              <div className="grid grid-cols-3 gap-4">
                <FormField label="Symbol">
                  <select
                    value={form.symbol}
                    onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                    className="w-full bg-muted text-foreground text-xs font-mono px-3 py-2 border border-border outline-none focus:border-cyan"
                  >
                    {SYMBOLS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Direction">
                  <div className="flex border border-border">
                    <button
                      onClick={() => setForm({ ...form, direction: "long" })}
                      className={`flex-1 py-2 text-xs font-bold font-mono uppercase ${
                        form.direction === "long"
                          ? "bg-bullish/20 text-bullish border-r border-border"
                          : "text-muted-foreground border-r border-border hover:bg-muted"
                      }`}
                    >
                      Long
                    </button>
                    <button
                      onClick={() => setForm({ ...form, direction: "short" })}
                      className={`flex-1 py-2 text-xs font-bold font-mono uppercase ${
                        form.direction === "short"
                          ? "bg-bearish/20 text-bearish"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      Short
                    </button>
                  </div>
                </FormField>
                <FormField label="Status">
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as TradeStatus })}
                    className="w-full bg-muted text-foreground text-xs font-mono px-3 py-2 border border-border outline-none focus:border-cyan"
                  >
                    <option value="open">Open</option>
                    <option value="closed">Closed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </FormField>
              </div>

              {/* Row 2: Prices */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <FormField label="Entry Price *">
                  <input
                    type="text"
                    value={form.entryPrice}
                    onChange={(e) => setForm({ ...form, entryPrice: e.target.value })}
                    placeholder="1.08500"
                    className="w-full bg-muted text-foreground text-xs font-mono px-3 py-2 border border-border outline-none focus:border-cyan"
                  />
                </FormField>
                <FormField label="Exit Price">
                  <input
                    type="text"
                    value={form.exitPrice}
                    onChange={(e) => setForm({ ...form, exitPrice: e.target.value })}
                    placeholder="1.09200"
                    className="w-full bg-muted text-foreground text-xs font-mono px-3 py-2 border border-border outline-none focus:border-cyan"
                  />
                </FormField>
                <FormField label="Stop Loss">
                  <input
                    type="text"
                    value={form.stopLoss}
                    onChange={(e) => setForm({ ...form, stopLoss: e.target.value })}
                    placeholder="1.08200"
                    className="w-full bg-muted text-foreground text-xs font-mono px-3 py-2 border border-border outline-none focus:border-cyan"
                  />
                </FormField>
                <FormField label="Take Profit">
                  <input
                    type="text"
                    value={form.takeProfit}
                    onChange={(e) => setForm({ ...form, takeProfit: e.target.value })}
                    placeholder="1.09500"
                    className="w-full bg-muted text-foreground text-xs font-mono px-3 py-2 border border-border outline-none focus:border-cyan"
                  />
                </FormField>
              </div>

              {/* Row 3: Risk & Position */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <FormField label="Position Size">
                  <input
                    type="text"
                    value={form.positionSize}
                    onChange={(e) => setForm({ ...form, positionSize: e.target.value })}
                    placeholder="0.5"
                    className="w-full bg-muted text-foreground text-xs font-mono px-3 py-2 border border-border outline-none focus:border-cyan"
                  />
                </FormField>
                <FormField label="Risk %">
                  <input
                    type="text"
                    value={form.riskPercent}
                    onChange={(e) => setForm({ ...form, riskPercent: e.target.value })}
                    placeholder="1"
                    className="w-full bg-muted text-foreground text-xs font-mono px-3 py-2 border border-border outline-none focus:border-cyan"
                  />
                </FormField>
                <FormField label="R:R Ratio">
                  <input
                    type="text"
                    value={form.riskReward}
                    onChange={(e) => setForm({ ...form, riskReward: e.target.value })}
                    placeholder="3.0"
                    className="w-full bg-muted text-foreground text-xs font-mono px-3 py-2 border border-border outline-none focus:border-cyan"
                  />
                </FormField>
                <FormField label="Timeframe">
                  <select
                    value={form.timeframe}
                    onChange={(e) => setForm({ ...form, timeframe: e.target.value })}
                    className="w-full bg-muted text-foreground text-xs font-mono px-3 py-2 border border-border outline-none focus:border-cyan"
                  >
                    {TIMEFRAMES.map((tf) => (
                      <option key={tf} value={tf}>{tf}</option>
                    ))}
                  </select>
                </FormField>
              </div>

              {/* Row 4: P&L (for closed trades) */}
              {form.status === "closed" && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="P&L (Pips)">
                    <input
                      type="text"
                      value={form.pnlPips}
                      onChange={(e) => setForm({ ...form, pnlPips: e.target.value })}
                      placeholder="70"
                      className="w-full bg-muted text-foreground text-xs font-mono px-3 py-2 border border-border outline-none focus:border-cyan"
                    />
                  </FormField>
                  <FormField label="P&L ($)">
                    <input
                      type="text"
                      value={form.pnlAmount}
                      onChange={(e) => setForm({ ...form, pnlAmount: e.target.value })}
                      placeholder="350.00"
                      className="w-full bg-muted text-foreground text-xs font-mono px-3 py-2 border border-border outline-none focus:border-cyan"
                    />
                  </FormField>
                </div>
              )}

              {/* Row 5: Times */}
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Entry Time *">
                  <input
                    type="datetime-local"
                    value={form.entryTime}
                    onChange={(e) => setForm({ ...form, entryTime: e.target.value })}
                    className="w-full bg-muted text-foreground text-xs font-mono px-3 py-2 border border-border outline-none focus:border-cyan"
                  />
                </FormField>
                <FormField label="Exit Time">
                  <input
                    type="datetime-local"
                    value={form.exitTime}
                    onChange={(e) => setForm({ ...form, exitTime: e.target.value })}
                    className="w-full bg-muted text-foreground text-xs font-mono px-3 py-2 border border-border outline-none focus:border-cyan"
                  />
                </FormField>
              </div>

              {/* Row 6: Setup & Strategy */}
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Setup Type">
                  <select
                    value={form.setupType}
                    onChange={(e) => setForm({ ...form, setupType: e.target.value })}
                    className="w-full bg-muted text-foreground text-xs font-mono px-3 py-2 border border-border outline-none focus:border-cyan"
                  >
                    <option value="">Select...</option>
                    {SETUP_TYPES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Followed Strategy?">
                  <div className="flex border border-border">
                    <button
                      onClick={() => setForm({ ...form, followedStrategy: true })}
                      className={`flex-1 py-2 text-xs font-bold font-mono uppercase ${
                        form.followedStrategy
                          ? "bg-bullish/20 text-bullish border-r border-border"
                          : "text-muted-foreground border-r border-border hover:bg-muted"
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setForm({ ...form, followedStrategy: false })}
                      className={`flex-1 py-2 text-xs font-bold font-mono uppercase ${
                        !form.followedStrategy
                          ? "bg-bearish/20 text-bearish"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      No
                    </button>
                  </div>
                </FormField>
              </div>

              {/* Row 7: Notes */}
              <FormField label="Trade Notes">
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="What was the setup? What did you see on the chart?"
                  rows={3}
                  className="w-full bg-muted text-foreground text-xs font-mono px-3 py-2 border border-border outline-none focus:border-cyan resize-none"
                />
              </FormField>

              {/* Row 8: Post-Trade Review */}
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Deviations from Plan">
                  <textarea
                    value={form.deviations}
                    onChange={(e) => setForm({ ...form, deviations: e.target.value })}
                    placeholder="What did you do differently?"
                    rows={2}
                    className="w-full bg-muted text-foreground text-xs font-mono px-3 py-2 border border-border outline-none focus:border-cyan resize-none"
                  />
                </FormField>
                <FormField label="Areas for Improvement">
                  <textarea
                    value={form.improvements}
                    onChange={(e) => setForm({ ...form, improvements: e.target.value })}
                    placeholder="What would you do differently next time?"
                    rows={2}
                    className="w-full bg-muted text-foreground text-xs font-mono px-3 py-2 border border-border outline-none focus:border-cyan resize-none"
                  />
                </FormField>
              </div>

              {/* Row 9: Screenshot */}
              <ScreenshotCapture
                tradeId={editingId || undefined}
                currentUrl={form.screenshotUrl || null}
                onScreenshotUploaded={(url) => setForm({ ...form, screenshotUrl: url })}
              />

              {/* Submit */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 py-3 bg-primary text-primary-foreground font-bold text-sm uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Saving..."
                    : editingId
                    ? "Update Trade"
                    : "Log Trade"}
                </button>
                <button
                  onClick={resetForm}
                  className="px-6 py-3 bg-muted text-foreground font-bold text-sm uppercase tracking-wider hover:bg-muted/80 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-card border-2 border-border p-3">
      <div className="flex items-center gap-2 mb-1">
        <span className={color}>{icon}</span>
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <div className={`text-lg font-bold font-mono ${color}`}>{value}</div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function TradeRow({
  trade,
  expanded,
  onToggle,
  onEdit,
  onDelete,
}: {
  trade: any;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const pnl = trade.pnlAmount ? parseFloat(trade.pnlAmount) : null;
  const isWin = pnl !== null && pnl > 0;
  const isLoss = pnl !== null && pnl < 0;

  return (
    <div className="border-2 border-border bg-card">
      {/* Main row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={onToggle}
      >
        {/* Direction indicator */}
        <div className={`w-1.5 h-10 ${trade.direction === "long" ? "bg-bullish" : "bg-bearish"}`} />

        {/* Symbol & Direction */}
        <div className="min-w-[100px]">
          <div className="text-sm font-bold font-mono text-foreground">{trade.symbol}</div>
          <div className={`text-[10px] font-mono uppercase ${trade.direction === "long" ? "text-bullish" : "text-bearish"}`}>
            {trade.direction}
          </div>
        </div>

        {/* Entry/Exit */}
        <div className="hidden md:block min-w-[120px]">
          <div className="text-xs font-mono text-foreground">
            Entry: <span className="text-cyan">{trade.entryPrice}</span>
          </div>
          {trade.exitPrice && (
            <div className="text-xs font-mono text-foreground">
              Exit: <span className="text-muted-foreground">{trade.exitPrice}</span>
            </div>
          )}
        </div>

        {/* Status */}
        <div className="hidden sm:block">
          <span className={`text-[10px] font-mono uppercase px-2 py-0.5 border ${
            trade.status === "open"
              ? "text-cyan border-cyan/30 bg-cyan/5"
              : trade.status === "closed"
              ? "text-muted-foreground border-border bg-muted/30"
              : "text-warning border-warning/30 bg-warning/5"
          }`}>
            {trade.status}
          </span>
        </div>

        {/* P&L */}
        <div className="ml-auto text-right min-w-[80px]">
          {pnl !== null ? (
            <>
              <div className={`text-sm font-bold font-mono ${isWin ? "text-bullish" : isLoss ? "text-bearish" : "text-foreground"}`}>
                {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}
              </div>
              {trade.pnlPips && (
                <div className="text-[10px] font-mono text-muted-foreground">
                  {parseFloat(trade.pnlPips) >= 0 ? "+" : ""}{parseFloat(trade.pnlPips).toFixed(1)} pips
                </div>
              )}
            </>
          ) : (
            <span className="text-xs font-mono text-muted-foreground">—</span>
          )}
        </div>

        {/* Strategy adherence */}
        <div className="hidden lg:block">
          {trade.followedStrategy === true ? (
            <CheckCircle className="w-4 h-4 text-bullish" />
          ) : trade.followedStrategy === false ? (
            <XCircle className="w-4 h-4 text-bearish" />
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>

        {/* Date */}
        <div className="hidden lg:block text-[10px] font-mono text-muted-foreground min-w-[80px] text-right">
          {new Date(trade.entryTime).toLocaleDateString()}
        </div>

        {/* Expand icon */}
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 py-4 border-t border-border/50 bg-muted/10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <DetailItem label="Setup Type" value={trade.setupType || "—"} />
            <DetailItem label="Timeframe" value={trade.timeframe || "—"} />
            <DetailItem label="Risk %" value={trade.riskPercent ? `${trade.riskPercent}%` : "—"} />
            <DetailItem label="R:R" value={trade.riskReward || "—"} />
            <DetailItem label="Stop Loss" value={trade.stopLoss || "—"} />
            <DetailItem label="Take Profit" value={trade.takeProfit || "—"} />
            <DetailItem label="Position Size" value={trade.positionSize || "—"} />
            <DetailItem
              label="Followed Strategy"
              value={trade.followedStrategy === true ? "Yes" : trade.followedStrategy === false ? "No" : "—"}
              color={trade.followedStrategy === true ? "text-bullish" : trade.followedStrategy === false ? "text-bearish" : ""}
            />
          </div>

          {trade.notes && (
            <div className="mb-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Notes</span>
              <p className="text-xs font-mono text-foreground mt-1">{trade.notes}</p>
            </div>
          )}
          {trade.deviations && (
            <div className="mb-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Deviations</span>
              <p className="text-xs font-mono text-foreground mt-1">{trade.deviations}</p>
            </div>
          )}
          {trade.improvements && (
            <div className="mb-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Improvements</span>
              <p className="text-xs font-mono text-foreground mt-1">{trade.improvements}</p>
            </div>
          )}

          {trade.screenshotUrl && (
            <div className="mb-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-1.5">
                <ImageIcon className="w-3 h-3" />
                Chart Screenshot
              </span>
              <a href={trade.screenshotUrl} target="_blank" rel="noopener noreferrer">
                <img
                  src={trade.screenshotUrl}
                  alt="Trade chart screenshot"
                  className="w-full max-h-60 object-cover border-2 border-border hover:border-cyan/50 transition-colors cursor-pointer"
                />
              </a>
            </div>
          )}

          <div className="flex gap-2 mt-4 pt-3 border-t border-border/30">
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase text-cyan border border-cyan/30 hover:bg-cyan/10 transition-colors"
            >
              <Edit2 className="w-3 h-3" />
              Edit
            </button>
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase text-bearish border border-bearish/30 hover:bg-bearish/10 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className={`text-xs font-mono mt-0.5 ${color || "text-foreground"}`}>{value}</div>
    </div>
  );
}
