/**
 * ICTAnalysis — Production-grade ICT concepts analysis view
 * Real SVG visualizations for Session Map, Currency Strength Heatmap,
 * Correlation Matrix, PD/PW Levels, Judas Swing, Premium/Discount Zone
 */

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import {
  Clock, TrendingUp, TrendingDown, Zap, BarChart3, Grid3X3,
  Activity, Gauge, Sun, Moon, Target, AlertTriangle,
  ChevronDown, ChevronRight, Calendar, RefreshCw
} from "lucide-react";

const SYMBOLS = [
  "EUR/USD", "GBP/USD", "USD/JPY", "GBP/JPY", "AUD/USD",
  "USD/CAD", "EUR/GBP", "NZD/USD", "XAU/USD", "BTC/USD",
];

const SESSIONS = [
  { name: "Sydney", start: 21, end: 6, color: "#a78bfa", bg: "rgba(167,139,250,0.15)" },
  { name: "Asian", start: 0, end: 8, color: "#c084fc", bg: "rgba(192,132,252,0.15)" },
  { name: "London", start: 7, end: 16, color: "#60a5fa", bg: "rgba(96,165,250,0.15)" },
  { name: "New York", start: 12, end: 21, color: "#fbbf24", bg: "rgba(251,191,36,0.15)" },
];

const KILL_ZONES = [
  { name: "Asian KZ", start: 0, end: 3, color: "#c084fc" },
  { name: "London KZ", start: 7, end: 9, color: "#60a5fa" },
  { name: "NY KZ", start: 12, end: 14, color: "#fbbf24" },
  { name: "London Close KZ", start: 15, end: 16, color: "#34d399" },
];

export default function ICTAnalysis() {
  const [selectedSymbol, setSelectedSymbol] = useState("EUR/USD");
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(
    new Set(["session", "strength", "correlations", "pdpw", "judas", "premium", "fundamentals"])
  );

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.symbol) setSelectedSymbol(detail.symbol);
    };
    window.addEventListener("smc-symbol-change", handler);
    return () => window.removeEventListener("smc-symbol-change", handler);
  }, []);

  const togglePanel = (id: string) => {
    setExpandedPanels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ─── Data Queries ────────────────────────────────────────────────
  const sessionInfo = trpc.ict.sessionInfo.useQuery(
    { symbol: selectedSymbol },
    { refetchInterval: 60000 }
  );
  const currencyStrength = trpc.ict.currencyStrength.useQuery(undefined, {
    refetchInterval: 120000,
  });
  const correlations = trpc.ict.correlations.useQuery(undefined, {
    refetchInterval: 300000,
  });
  const pdLevels = trpc.ict.pdLevels.useQuery(
    { symbol: selectedSymbol },
    { refetchInterval: 120000 }
  );
  const judasSwing = trpc.ict.judasSwing.useQuery(
    { symbol: selectedSymbol },
    { refetchInterval: 60000 }
  );
  const premiumDiscount = trpc.ict.premiumDiscount.useQuery(
    { symbol: selectedSymbol },
    { refetchInterval: 60000 }
  );

  const correlationMatrix = useMemo(() => {
    if (!correlations.data) return null;
    const pairs = Array.from(
      new Set(correlations.data.flatMap((c) => [c.pair1, c.pair2]))
    );
    const matrix: Record<string, Record<string, number>> = {};
    pairs.forEach((p) => {
      matrix[p] = {};
      pairs.forEach((q) => {
        matrix[p][q] = p === q ? 1 : 0;
      });
    });
    correlations.data.forEach((c) => {
      matrix[c.pair1][c.pair2] = c.coefficient;
      matrix[c.pair2][c.pair1] = c.coefficient;
    });
    return { pairs, matrix };
  }, [correlations.data]);

  const isJPY = selectedSymbol.includes("JPY");
  const decimals = isJPY ? 3 : 5;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Symbol selector sidebar */}
      <div className="w-40 flex-shrink-0 bg-card border-r border-border overflow-y-auto">
        <div className="px-3 py-2 border-b border-border">
          <div className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-wider">
            Instrument
          </div>
        </div>
        {SYMBOLS.map((sym) => (
          <button
            key={sym}
            onClick={() => setSelectedSymbol(sym)}
            className={`w-full text-left px-3 py-2 text-xs font-mono transition-colors border-b border-border/30 ${
              selectedSymbol === sym
                ? "bg-cyan/10 text-cyan font-bold"
                : "text-foreground hover:bg-muted/30"
            }`}
          >
            {sym}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-cyan" />
              <h1 className="text-lg font-bold text-foreground tracking-tight">
                ICT Analysis
              </h1>
              <span className="text-sm font-mono text-cyan font-bold">
                {selectedSymbol}
              </span>
            </div>
          </div>

          {/* ═══ SESSION MAP — SVG Timeline ═══ */}
          <Panel
            id="session"
            title="Session Map / Kill Zones"
            icon={<Clock className="w-4 h-4" />}
            expanded={expandedPanels.has("session")}
            onToggle={() => togglePanel("session")}
          >
            {sessionInfo.isLoading ? (
              <LoadingState />
            ) : sessionInfo.data ? (
              <div className="space-y-4">
                {/* Active session badge */}
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      sessionInfo.data.active
                        ? "bg-bullish animate-pulse"
                        : "bg-muted-foreground"
                    }`}
                  />
                  <div>
                    <div className="text-sm font-bold font-mono text-foreground">
                      {sessionInfo.data.name} Session
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {sessionInfo.data.active ? "Currently Active" : "Inactive"}
                      {sessionInfo.data.isKillZone && (
                        <span className="ml-2 text-warning font-bold">
                          ⚡ KILL ZONE
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Session levels */}
                {sessionInfo.data.sessionHigh > 0 && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-muted/30 border border-border p-3">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                        Session Open
                      </div>
                      <div className="text-sm font-bold font-mono text-foreground">
                        {sessionInfo.data.sessionOpen.toFixed(decimals)}
                      </div>
                    </div>
                    <div className="bg-muted/30 border border-border p-3">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                        Session High
                      </div>
                      <div className="text-sm font-bold font-mono text-bullish">
                        {sessionInfo.data.sessionHigh.toFixed(decimals)}
                      </div>
                    </div>
                    <div className="bg-muted/30 border border-border p-3">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                        Session Low
                      </div>
                      <div className="text-sm font-bold font-mono text-bearish">
                        {sessionInfo.data.sessionLow.toFixed(decimals)}
                      </div>
                    </div>
                  </div>
                )}

                {/* SVG Session Timeline */}
                <SessionTimeline currentSession={sessionInfo.data.name} />
              </div>
            ) : (
              <EmptyState text="Session data unavailable" />
            )}
          </Panel>

          {/* ═══ CURRENCY STRENGTH — SVG Heatmap Grid ═══ */}
          <Panel
            id="strength"
            title="Currency Strength Heatmap"
            icon={<Gauge className="w-4 h-4" />}
            expanded={expandedPanels.has("strength")}
            onToggle={() => togglePanel("strength")}
          >
            {currencyStrength.isLoading ? (
              <LoadingState />
            ) : currencyStrength.data?.length ? (
              <CurrencyStrengthHeatmap data={currencyStrength.data} />
            ) : (
              <EmptyState text="Currency strength data unavailable" />
            )}
          </Panel>

          {/* ═══ CORRELATION MATRIX — SVG Color Grid ═══ */}
          <Panel
            id="correlations"
            title="Correlation Matrix"
            icon={<Grid3X3 className="w-4 h-4" />}
            expanded={expandedPanels.has("correlations")}
            onToggle={() => togglePanel("correlations")}
          >
            {correlations.isLoading ? (
              <LoadingState />
            ) : correlationMatrix ? (
              <CorrelationMatrixSVG data={correlationMatrix} />
            ) : (
              <EmptyState text="Correlation data unavailable" />
            )}
          </Panel>

          {/* ═══ PD/PW LEVELS — Visual Price Ladder ═══ */}
          <Panel
            id="pdpw"
            title="PD/PW Levels (Previous Day / Week)"
            icon={<BarChart3 className="w-4 h-4" />}
            expanded={expandedPanels.has("pdpw")}
            onToggle={() => togglePanel("pdpw")}
          >
            {pdLevels.isLoading ? (
              <LoadingState />
            ) : pdLevels.data ? (
              <PriceLadder data={pdLevels.data} decimals={decimals} />
            ) : (
              <EmptyState text="PD/PW level data unavailable" />
            )}
          </Panel>

          {/* ═══ JUDAS SWING ═══ */}
          <Panel
            id="judas"
            title="Judas Swing Detection"
            icon={<AlertTriangle className="w-4 h-4" />}
            expanded={expandedPanels.has("judas")}
            onToggle={() => togglePanel("judas")}
          >
            {judasSwing.isLoading ? (
              <LoadingState />
            ) : judasSwing.data ? (
              <JudasSwingVisual data={judasSwing.data} decimals={decimals} />
            ) : (
              <EmptyState text="Judas swing data unavailable" />
            )}
          </Panel>

          {/* ═══ PREMIUM / DISCOUNT ZONE — SVG Gauge ═══ */}
          <Panel
            id="premium"
            title="Premium / Discount Zone"
            icon={<Target className="w-4 h-4" />}
            expanded={expandedPanels.has("premium")}
            onToggle={() => togglePanel("premium")}
          >
            {premiumDiscount.isLoading ? (
              <LoadingState />
            ) : premiumDiscount.data ? (
              <PremiumDiscountGauge
                data={premiumDiscount.data}
                decimals={decimals}
              />
            ) : (
              <EmptyState text="Premium/Discount data unavailable" />
            )}
          </Panel>

          {/* ═══ FUNDAMENTALS ═══ */}
          <FundamentalsPanel
            selectedSymbol={selectedSymbol}
            expanded={expandedPanels.has("fundamentals")}
            onToggle={() => togglePanel("fundamentals")}
          />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SESSION TIMELINE — Full SVG with current time marker, kill zones, overlaps
// ═══════════════════════════════════════════════════════════════════════
function SessionTimeline({ currentSession }: { currentSession: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const W = 760;
  const H = 160;
  const PAD_L = 30;
  const PAD_R = 10;
  const chartW = W - PAD_L - PAD_R;
  const hourToX = (h: number) => PAD_L + (h / 24) * chartW;

  const utcHour = now.getUTCHours() + now.getUTCMinutes() / 60;
  const nowX = hourToX(utcHour);

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
        24h Session Timeline (UTC) — Current Time Marker
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        style={{ minHeight: 120 }}
      >
        {/* Background */}
        <rect x={PAD_L} y={0} width={chartW} height={H} fill="var(--muted)" opacity={0.15} rx={4} />

        {/* Hour grid lines */}
        {Array.from({ length: 25 }, (_, i) => (
          <g key={i}>
            <line
              x1={hourToX(i)}
              y1={0}
              x2={hourToX(i)}
              y2={H}
              stroke="var(--border)"
              strokeWidth={i % 6 === 0 ? 1 : 0.3}
              strokeDasharray={i % 6 === 0 ? "none" : "2,4"}
            />
            {i < 24 && i % 3 === 0 && (
              <text
                x={hourToX(i)}
                y={H - 2}
                textAnchor="middle"
                fill="var(--muted-foreground)"
                fontSize={9}
                fontFamily="monospace"
              >
                {String(i).padStart(2, "0")}:00
              </text>
            )}
          </g>
        ))}

        {/* Session bars */}
        {SESSIONS.map((s, i) => {
          const y = 10 + i * 26;
          const barH = 22;
          // Handle wrap-around (Sydney 21-06)
          if (s.start > s.end) {
            return (
              <g key={s.name}>
                <rect x={hourToX(s.start)} y={y} width={hourToX(24) - hourToX(s.start)} height={barH} fill={s.bg} rx={3} stroke={s.color} strokeWidth={1} />
                <rect x={hourToX(0)} y={y} width={hourToX(s.end) - hourToX(0)} height={barH} fill={s.bg} rx={3} stroke={s.color} strokeWidth={1} />
                <text x={hourToX(s.start) + 6} y={y + 15} fill={s.color} fontSize={10} fontFamily="monospace" fontWeight="bold">
                  {s.name}
                </text>
              </g>
            );
          }
          return (
            <g key={s.name}>
              <rect
                x={hourToX(s.start)}
                y={y}
                width={hourToX(s.end) - hourToX(s.start)}
                height={barH}
                fill={s.bg}
                rx={3}
                stroke={s.color}
                strokeWidth={1}
              />
              <text
                x={hourToX(s.start) + 6}
                y={y + 15}
                fill={s.color}
                fontSize={10}
                fontFamily="monospace"
                fontWeight="bold"
              >
                {s.name}
              </text>
            </g>
          );
        })}

        {/* Kill zone overlays */}
        {KILL_ZONES.map((kz) => (
          <rect
            key={kz.name}
            x={hourToX(kz.start)}
            y={0}
            width={hourToX(kz.end) - hourToX(kz.start)}
            height={H - 14}
            fill={kz.color}
            opacity={0.08}
            stroke={kz.color}
            strokeWidth={1}
            strokeDasharray="4,2"
          />
        ))}

        {/* Current time marker */}
        <line x1={nowX} y1={0} x2={nowX} y2={H - 14} stroke="var(--foreground)" strokeWidth={2} />
        <circle cx={nowX} cy={4} r={4} fill="var(--foreground)" />
        <text x={nowX} y={H - 4} textAnchor="middle" fill="var(--foreground)" fontSize={9} fontFamily="monospace" fontWeight="bold">
          NOW
        </text>
      </svg>

      {/* Kill zone legend */}
      <div className="flex flex-wrap gap-4 text-[10px] font-mono text-muted-foreground">
        {KILL_ZONES.map((kz) => (
          <div key={kz.name} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 border"
              style={{ backgroundColor: kz.color + "30", borderColor: kz.color }}
            />
            <span>
              {kz.name}: {String(kz.start).padStart(2, "0")}:00-
              {String(kz.end).padStart(2, "0")}:00
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// CURRENCY STRENGTH HEATMAP — SVG bar chart with gradient fills
// ═══════════════════════════════════════════════════════════════════════
function CurrencyStrengthHeatmap({
  data,
}: {
  data: Array<{ currency: string; strength: number; rank: number }>;
}) {
  const W = 760;
  const barH = 28;
  const PAD_L = 50;
  const PAD_R = 60;
  const chartW = W - PAD_L - PAD_R;
  const H = data.length * (barH + 4) + 20;
  const maxAbs = Math.max(...data.map((d) => Math.abs(d.strength)), 0.01);
  const centerX = PAD_L + chartW / 2;

  return (
    <div className="space-y-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ minHeight: data.length * 28 }}>
        <defs>
          <linearGradient id="bullGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--bullish)" stopOpacity={0.2} />
            <stop offset="100%" stopColor="var(--bullish)" stopOpacity={0.7} />
          </linearGradient>
          <linearGradient id="bearGrad" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="var(--bearish)" stopOpacity={0.2} />
            <stop offset="100%" stopColor="var(--bearish)" stopOpacity={0.7} />
          </linearGradient>
        </defs>

        {/* Center line */}
        <line x1={centerX} y1={0} x2={centerX} y2={H} stroke="var(--border)" strokeWidth={1} />
        <text x={centerX} y={H - 2} textAnchor="middle" fill="var(--muted-foreground)" fontSize={9} fontFamily="monospace">
          0%
        </text>

        {data.map((d, i) => {
          const y = i * (barH + 4) + 2;
          const barWidth = (Math.abs(d.strength) / maxAbs) * (chartW / 2);
          const isPos = d.strength >= 0;
          const barX = isPos ? centerX : centerX - barWidth;

          return (
            <g key={d.currency}>
              {/* Row background */}
              <rect x={PAD_L} y={y} width={chartW} height={barH} fill="var(--muted)" opacity={0.08} rx={2} />

              {/* Bar */}
              <rect
                x={barX}
                y={y + 3}
                width={barWidth}
                height={barH - 6}
                fill={isPos ? "url(#bullGrad)" : "url(#bearGrad)"}
                rx={2}
              />
              <rect
                x={barX}
                y={y + 3}
                width={barWidth}
                height={barH - 6}
                fill="none"
                stroke={isPos ? "var(--bullish)" : "var(--bearish)"}
                strokeWidth={0.5}
                rx={2}
              />

              {/* Currency label */}
              <text x={PAD_L - 6} y={y + barH / 2 + 4} textAnchor="end" fill="var(--foreground)" fontSize={12} fontFamily="monospace" fontWeight="bold">
                {d.currency}
              </text>

              {/* Value label */}
              <text
                x={isPos ? centerX + barWidth + 6 : centerX - barWidth - 6}
                y={y + barH / 2 + 4}
                textAnchor={isPos ? "start" : "end"}
                fill={isPos ? "var(--bullish)" : "var(--bearish)"}
                fontSize={11}
                fontFamily="monospace"
                fontWeight="bold"
              >
                {d.strength > 0 ? "+" : ""}
                {d.strength.toFixed(2)}%
              </text>

              {/* Rank badge */}
              <text x={W - 10} y={y + barH / 2 + 4} textAnchor="end" fill="var(--muted-foreground)" fontSize={9} fontFamily="monospace">
                #{d.rank}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Summary */}
      <div className="flex gap-4 text-[10px] font-mono text-muted-foreground border-t border-border/50 pt-2">
        <span>
          Strongest:{" "}
          <span className="text-bullish font-bold">{data[0]?.currency}</span>
        </span>
        <span>
          Weakest:{" "}
          <span className="text-bearish font-bold">
            {data[data.length - 1]?.currency}
          </span>
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// CORRELATION MATRIX — SVG color-coded grid with hover tooltips
// ═══════════════════════════════════════════════════════════════════════
function CorrelationMatrixSVG({
  data,
}: {
  data: { pairs: string[]; matrix: Record<string, Record<string, number>> };
}) {
  const [hoveredCell, setHoveredCell] = useState<{
    row: string;
    col: string;
    val: number;
  } | null>(null);

  const cellSize = 52;
  const labelW = 65;
  const labelH = 50;
  const n = data.pairs.length;
  const W = labelW + n * cellSize + 10;
  const H = labelH + n * cellSize + 10;

  const getColor = (val: number): string => {
    if (val === 1) return "rgba(0,200,200,0.4)";
    if (val > 0.7) return "rgba(34,197,94,0.5)";
    if (val > 0.3) return "rgba(34,197,94,0.25)";
    if (val > -0.3) return "rgba(128,128,128,0.15)";
    if (val > -0.7) return "rgba(239,68,68,0.25)";
    return "rgba(239,68,68,0.5)";
  };

  const getTextColor = (val: number): string => {
    if (val === 1) return "var(--cyan)";
    if (val > 0.5) return "var(--bullish)";
    if (val < -0.5) return "var(--bearish)";
    return "var(--muted-foreground)";
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ minWidth: 400, minHeight: 300 }}>
          {/* Column headers */}
          {data.pairs.map((p, i) => (
            <text
              key={`ch-${p}`}
              x={labelW + i * cellSize + cellSize / 2}
              y={labelH - 8}
              textAnchor="middle"
              fill="var(--muted-foreground)"
              fontSize={9}
              fontFamily="monospace"
              fontWeight="bold"
              transform={`rotate(-35, ${labelW + i * cellSize + cellSize / 2}, ${labelH - 8})`}
            >
              {p.replace("/", "")}
            </text>
          ))}

          {/* Rows */}
          {data.pairs.map((row, ri) => (
            <g key={`row-${row}`}>
              {/* Row label */}
              <text
                x={labelW - 6}
                y={labelH + ri * cellSize + cellSize / 2 + 4}
                textAnchor="end"
                fill="var(--foreground)"
                fontSize={10}
                fontFamily="monospace"
                fontWeight="bold"
              >
                {row.replace("/", "")}
              </text>

              {/* Cells */}
              {data.pairs.map((col, ci) => {
                const val = data.matrix[row][col];
                const x = labelW + ci * cellSize;
                const y = labelH + ri * cellSize;
                const isHovered =
                  hoveredCell?.row === row && hoveredCell?.col === col;

                return (
                  <g
                    key={`${row}-${col}`}
                    onMouseEnter={() => setHoveredCell({ row, col, val })}
                    onMouseLeave={() => setHoveredCell(null)}
                    style={{ cursor: "pointer" }}
                  >
                    <rect
                      x={x + 1}
                      y={y + 1}
                      width={cellSize - 2}
                      height={cellSize - 2}
                      fill={getColor(val)}
                      stroke={isHovered ? "var(--foreground)" : "var(--border)"}
                      strokeWidth={isHovered ? 2 : 0.5}
                      rx={3}
                    />
                    <text
                      x={x + cellSize / 2}
                      y={y + cellSize / 2 + 4}
                      textAnchor="middle"
                      fill={getTextColor(val)}
                      fontSize={11}
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {val.toFixed(2)}
                    </text>
                  </g>
                );
              })}
            </g>
          ))}
        </svg>
      </div>

      {/* Hover tooltip */}
      {hoveredCell && (
        <div className="text-xs font-mono text-foreground bg-card border border-border px-3 py-1.5">
          {hoveredCell.row} vs {hoveredCell.col}:{" "}
          <span
            className={
              hoveredCell.val > 0.5
                ? "text-bullish"
                : hoveredCell.val < -0.5
                ? "text-bearish"
                : "text-muted-foreground"
            }
          >
            {hoveredCell.val.toFixed(4)}
          </span>
          {" — "}
          {hoveredCell.val > 0.7
            ? "Strong positive correlation"
            : hoveredCell.val > 0.3
            ? "Moderate positive correlation"
            : hoveredCell.val > -0.3
            ? "Weak/no correlation"
            : hoveredCell.val > -0.7
            ? "Moderate negative correlation"
            : "Strong negative correlation"}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
        <span>Legend:</span>
        {[
          { label: "Strong +", color: "rgba(34,197,94,0.5)" },
          { label: "Mod +", color: "rgba(34,197,94,0.25)" },
          { label: "Neutral", color: "rgba(128,128,128,0.15)" },
          { label: "Mod -", color: "rgba(239,68,68,0.25)" },
          { label: "Strong -", color: "rgba(239,68,68,0.5)" },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1">
            <div
              className="w-4 h-3 border border-border/50 rounded-sm"
              style={{ backgroundColor: l.color }}
            />
            <span>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// PD/PW LEVELS — Visual Price Ladder with current price position
// ═══════════════════════════════════════════════════════════════════════
function PriceLadder({
  data,
  decimals,
}: {
  data: {
    pdh: number;
    pdl: number;
    pdo: number;
    pdc: number;
    pwh: number;
    pwl: number;
    pwo: number;
    pwc: number;
  };
  decimals: number;
}) {
  // Collect all levels and sort descending
  const levels = [
    { label: "PWH", value: data.pwh, type: "weekly" as const, color: "var(--bullish)" },
    { label: "PDH", value: data.pdh, type: "daily" as const, color: "var(--bullish)" },
    { label: "PDO", value: data.pdo, type: "daily" as const, color: "var(--foreground)" },
    { label: "PDC", value: data.pdc, type: "daily" as const, color: "var(--cyan)" },
    { label: "PWO", value: data.pwo, type: "weekly" as const, color: "var(--foreground)" },
    { label: "PWC", value: data.pwc, type: "weekly" as const, color: "var(--cyan)" },
    { label: "PDL", value: data.pdl, type: "daily" as const, color: "var(--bearish)" },
    { label: "PWL", value: data.pwl, type: "weekly" as const, color: "var(--bearish)" },
  ].sort((a, b) => b.value - a.value);

  const maxVal = levels[0]?.value ?? 1;
  const minVal = levels[levels.length - 1]?.value ?? 0;
  const range = maxVal - minVal || 0.0001;

  const W = 760;
  const H = levels.length * 38 + 20;
  const PAD_L = 70;
  const PAD_R = 100;
  const chartW = W - PAD_L - PAD_R;

  return (
    <div className="space-y-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ minHeight: levels.length * 32 }}>
        {levels.map((lvl, i) => {
          const y = 10 + i * 38;
          const pct = ((lvl.value - minVal) / range) * 100;
          const barW = (pct / 100) * chartW;
          const isWeekly = lvl.type === "weekly";

          return (
            <g key={lvl.label}>
              {/* Label */}
              <text
                x={PAD_L - 8}
                y={y + 16}
                textAnchor="end"
                fill={lvl.color}
                fontSize={12}
                fontFamily="monospace"
                fontWeight="bold"
              >
                {lvl.label}
              </text>

              {/* Bar background */}
              <rect x={PAD_L} y={y + 4} width={chartW} height={20} fill="var(--muted)" opacity={0.1} rx={2} />

              {/* Bar fill */}
              <rect
                x={PAD_L}
                y={y + 4}
                width={barW}
                height={20}
                fill={lvl.color}
                opacity={isWeekly ? 0.25 : 0.15}
                rx={2}
              />
              <rect
                x={PAD_L}
                y={y + 4}
                width={barW}
                height={20}
                fill="none"
                stroke={lvl.color}
                strokeWidth={isWeekly ? 1.5 : 0.8}
                strokeDasharray={isWeekly ? "none" : "4,2"}
                rx={2}
              />

              {/* Price value */}
              <text
                x={PAD_L + barW + 8}
                y={y + 18}
                fill={lvl.color}
                fontSize={11}
                fontFamily="monospace"
                fontWeight="bold"
              >
                {lvl.value.toFixed(decimals)}
              </text>

              {/* Type badge */}
              <text x={W - 10} y={y + 18} textAnchor="end" fill="var(--muted-foreground)" fontSize={9} fontFamily="monospace">
                {isWeekly ? "WEEKLY" : "DAILY"}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Range stats */}
      <div className="grid grid-cols-2 gap-3 text-xs font-mono border-t border-border/50 pt-3">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Daily Range</span>
          <span className="text-foreground font-bold">
            {Math.abs(data.pdh - data.pdl).toFixed(decimals)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Weekly Range</span>
          <span className="text-foreground font-bold">
            {Math.abs(data.pwh - data.pwl).toFixed(decimals)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// JUDAS SWING — Visual sweep diagram with SVG
// ═══════════════════════════════════════════════════════════════════════
function JudasSwingVisual({
  data,
  decimals,
}: {
  data: {
    detected: boolean;
    type: string | null;
    midnightOpen: number;
    sweepHigh: number | null;
    sweepLow: number | null;
    reversalConfirmed: boolean;
    description: string;
  };
  decimals: number;
}) {
  const W = 760;
  const H = 180;

  if (!data.detected) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded flex items-center justify-center bg-muted/30 border border-border">
            <Activity className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <div className="text-sm font-bold font-mono text-muted-foreground">
              No Judas Swing Detected
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">
              {data.description}
            </div>
          </div>
        </div>
        <div className="text-[10px] font-mono text-muted-foreground bg-muted/20 p-2 border border-border/50">
          <strong className="text-foreground">ICT Judas Swing:</strong> A false
          move (sweep) during the London or NY open, designed to trap retail
          traders before the real move begins in the opposite direction.
        </div>
      </div>
    );
  }

  const isBullish = data.type === "bullish";
  const midY = 90;
  const sweepColor = isBullish ? "var(--bearish)" : "var(--bullish)";
  const reversalColor = isBullish ? "var(--bullish)" : "var(--bearish)";

  return (
    <div className="space-y-3">
      {/* Status badge */}
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded flex items-center justify-center ${
            isBullish
              ? "bg-bullish/20 border border-bullish/40"
              : "bg-bearish/20 border border-bearish/40"
          }`}
        >
          {isBullish ? (
            <TrendingUp className="w-5 h-5 text-bullish" />
          ) : (
            <TrendingDown className="w-5 h-5 text-bearish" />
          )}
        </div>
        <div>
          <div
            className={`text-sm font-bold font-mono ${
              isBullish ? "text-bullish" : "text-bearish"
            }`}
          >
            {data.type?.toUpperCase()} JUDAS SWING
          </div>
          <div className="text-[10px] text-muted-foreground font-mono">
            {data.description}
          </div>
        </div>
      </div>

      {/* SVG Diagram */}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ minHeight: 140 }}>
        {/* Midnight open line */}
        <line x1={40} y1={midY} x2={W - 40} y2={midY} stroke="var(--muted-foreground)" strokeWidth={1} strokeDasharray="6,3" />
        <text x={35} y={midY + 4} textAnchor="end" fill="var(--muted-foreground)" fontSize={9} fontFamily="monospace">
          MO
        </text>
        <text x={W - 35} y={midY + 4} textAnchor="start" fill="var(--muted-foreground)" fontSize={9} fontFamily="monospace">
          {data.midnightOpen.toFixed(decimals)}
        </text>

        {/* Sweep path */}
        {isBullish ? (
          <>
            {/* Bullish: sweep low then reverse up */}
            <path
              d={`M 100 ${midY} Q 200 ${midY} 280 ${midY + 50} Q 320 ${midY + 60} 360 ${midY + 50}`}
              fill="none"
              stroke={sweepColor}
              strokeWidth={2.5}
            />
            <circle cx={360} cy={midY + 50} r={5} fill={sweepColor} />
            <text x={360} y={midY + 70} textAnchor="middle" fill={sweepColor} fontSize={10} fontFamily="monospace" fontWeight="bold">
              SWEEP LOW {data.sweepLow?.toFixed(decimals)}
            </text>

            {/* Reversal */}
            <path
              d={`M 360 ${midY + 50} Q 440 ${midY + 30} 520 ${midY - 30} L 620 ${midY - 50}`}
              fill="none"
              stroke={reversalColor}
              strokeWidth={2.5}
              markerEnd="url(#arrowGreen)"
            />
            <text x={620} y={midY - 55} textAnchor="middle" fill={reversalColor} fontSize={10} fontFamily="monospace" fontWeight="bold">
              REVERSAL {data.reversalConfirmed ? "✓" : "?"}
            </text>
          </>
        ) : (
          <>
            {/* Bearish: sweep high then reverse down */}
            <path
              d={`M 100 ${midY} Q 200 ${midY} 280 ${midY - 50} Q 320 ${midY - 60} 360 ${midY - 50}`}
              fill="none"
              stroke={sweepColor}
              strokeWidth={2.5}
            />
            <circle cx={360} cy={midY - 50} r={5} fill={sweepColor} />
            <text x={360} y={midY - 60} textAnchor="middle" fill={sweepColor} fontSize={10} fontFamily="monospace" fontWeight="bold">
              SWEEP HIGH {data.sweepHigh?.toFixed(decimals)}
            </text>

            {/* Reversal */}
            <path
              d={`M 360 ${midY - 50} Q 440 ${midY - 30} 520 ${midY + 30} L 620 ${midY + 50}`}
              fill="none"
              stroke={reversalColor}
              strokeWidth={2.5}
            />
            <text x={620} y={midY + 65} textAnchor="middle" fill={reversalColor} fontSize={10} fontFamily="monospace" fontWeight="bold">
              REVERSAL {data.reversalConfirmed ? "✓" : "?"}
            </text>
          </>
        )}

        {/* Arrow markers */}
        <defs>
          <marker id="arrowGreen" markerWidth={8} markerHeight={6} refX={8} refY={3} orient="auto">
            <path d="M0,0 L8,3 L0,6" fill={reversalColor} />
          </marker>
        </defs>

        {/* Timeline labels */}
        <text x={100} y={H - 5} textAnchor="middle" fill="var(--muted-foreground)" fontSize={9} fontFamily="monospace">
          Midnight
        </text>
        <text x={280} y={H - 5} textAnchor="middle" fill="var(--muted-foreground)" fontSize={9} fontFamily="monospace">
          Session Open
        </text>
        <text x={520} y={H - 5} textAnchor="middle" fill="var(--muted-foreground)" fontSize={9} fontFamily="monospace">
          Reversal
        </text>
      </svg>

      {/* Key levels grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-muted/30 border border-border p-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
            Midnight Open
          </div>
          <div className="text-sm font-bold font-mono text-foreground">
            {data.midnightOpen.toFixed(decimals)}
          </div>
        </div>
        {data.sweepHigh !== null && (
          <div className="bg-muted/30 border border-border p-3">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
              Sweep High
            </div>
            <div className="text-sm font-bold font-mono text-bullish">
              {data.sweepHigh.toFixed(decimals)}
            </div>
          </div>
        )}
        {data.sweepLow !== null && (
          <div className="bg-muted/30 border border-border p-3">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
              Sweep Low
            </div>
            <div className="text-sm font-bold font-mono text-bearish">
              {data.sweepLow.toFixed(decimals)}
            </div>
          </div>
        )}
        <div className="bg-muted/30 border border-border p-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
            Reversal
          </div>
          <div
            className={`text-sm font-bold font-mono ${
              data.reversalConfirmed ? "text-bullish" : "text-muted-foreground"
            }`}
          >
            {data.reversalConfirmed ? "CONFIRMED" : "PENDING"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// PREMIUM/DISCOUNT GAUGE — SVG vertical gauge with OTE zone
// ═══════════════════════════════════════════════════════════════════════
function PremiumDiscountGauge({
  data,
  decimals,
}: {
  data: {
    currentZone: string;
    zonePercent: number;
    equilibrium: number;
    swingHigh: number;
    swingLow: number;
    oteZone: boolean;
  };
  decimals: number;
}) {
  const W = 760;
  const H = 220;
  const gaugeX = 80;
  const gaugeW = 60;
  const gaugeH = 180;
  const gaugeY = 20;

  const pct = Math.max(0, Math.min(100, data.zonePercent));
  const markerY = gaugeY + gaugeH - (pct / 100) * gaugeH;

  return (
    <div className="space-y-4">
      {/* Zone badges */}
      <div className="flex items-center gap-3">
        <div
          className={`px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider border ${
            data.currentZone === "premium"
              ? "bg-bearish/20 text-bearish border-bearish/40"
              : data.currentZone === "discount"
              ? "bg-bullish/20 text-bullish border-bullish/40"
              : "bg-warning/20 text-warning border-warning/40"
          }`}
        >
          {data.currentZone.toUpperCase()} ZONE
        </div>
        {data.oteZone && (
          <div className="px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider bg-cyan/20 text-cyan border border-cyan/40">
            OTE ZONE (62-79%)
          </div>
        )}
      </div>

      <div className="flex gap-8">
        {/* SVG Gauge */}
        <svg viewBox={`0 0 280 ${H}`} className="w-64 h-auto flex-shrink-0" style={{ minHeight: 180 }}>
          <defs>
            <linearGradient id="gaugeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--bearish)" stopOpacity={0.4} />
              <stop offset="50%" stopColor="var(--warning)" stopOpacity={0.2} />
              <stop offset="100%" stopColor="var(--bullish)" stopOpacity={0.4} />
            </linearGradient>
          </defs>

          {/* Gauge body */}
          <rect x={gaugeX} y={gaugeY} width={gaugeW} height={gaugeH} fill="url(#gaugeGrad)" stroke="var(--border)" strokeWidth={1} rx={4} />

          {/* OTE zone highlight (62-79%) */}
          <rect
            x={gaugeX}
            y={gaugeY + gaugeH - (79 / 100) * gaugeH}
            width={gaugeW}
            height={((79 - 62) / 100) * gaugeH}
            fill="var(--cyan)"
            opacity={0.2}
            stroke="var(--cyan)"
            strokeWidth={1}
            strokeDasharray="3,2"
          />

          {/* Equilibrium line (50%) */}
          <line
            x1={gaugeX - 15}
            y1={gaugeY + gaugeH / 2}
            x2={gaugeX + gaugeW + 15}
            y2={gaugeY + gaugeH / 2}
            stroke="var(--warning)"
            strokeWidth={1.5}
            strokeDasharray="4,2"
          />
          <text x={gaugeX + gaugeW + 20} y={gaugeY + gaugeH / 2 + 4} fill="var(--warning)" fontSize={10} fontFamily="monospace" fontWeight="bold">
            EQ {data.equilibrium.toFixed(decimals)}
          </text>

          {/* Current price marker */}
          <line x1={gaugeX - 20} y1={markerY} x2={gaugeX + gaugeW + 20} y2={markerY} stroke="var(--foreground)" strokeWidth={2} />
          <polygon
            points={`${gaugeX - 20},${markerY - 6} ${gaugeX - 20},${markerY + 6} ${gaugeX - 10},${markerY}`}
            fill="var(--foreground)"
          />
          <text x={gaugeX - 25} y={markerY + 4} textAnchor="end" fill="var(--foreground)" fontSize={11} fontFamily="monospace" fontWeight="bold">
            {pct.toFixed(0)}%
          </text>

          {/* Top/bottom labels */}
          <text x={gaugeX + gaugeW / 2} y={gaugeY - 5} textAnchor="middle" fill="var(--bearish)" fontSize={9} fontFamily="monospace" fontWeight="bold">
            PREMIUM
          </text>
          <text x={gaugeX + gaugeW / 2} y={gaugeY + gaugeH + 15} textAnchor="middle" fill="var(--bullish)" fontSize={9} fontFamily="monospace" fontWeight="bold">
            DISCOUNT
          </text>

          {/* Swing high/low values */}
          <text x={gaugeX + gaugeW + 20} y={gaugeY + 10} fill="var(--bearish)" fontSize={9} fontFamily="monospace">
            SH: {data.swingHigh.toFixed(decimals)}
          </text>
          <text x={gaugeX + gaugeW + 20} y={gaugeY + gaugeH} fill="var(--bullish)" fontSize={9} fontFamily="monospace">
            SL: {data.swingLow.toFixed(decimals)}
          </text>

          {/* OTE label */}
          <text
            x={gaugeX - 5}
            y={gaugeY + gaugeH - (70.5 / 100) * gaugeH + 4}
            textAnchor="end"
            fill="var(--cyan)"
            fontSize={8}
            fontFamily="monospace"
          >
            OTE
          </text>
        </svg>

        {/* Key levels grid */}
        <div className="flex-1 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-muted/30 border border-border p-3">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                Swing High
              </div>
              <div className="text-sm font-bold font-mono text-bearish">
                {data.swingHigh.toFixed(decimals)}
              </div>
            </div>
            <div className="bg-muted/30 border border-border p-3">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                Swing Low
              </div>
              <div className="text-sm font-bold font-mono text-bullish">
                {data.swingLow.toFixed(decimals)}
              </div>
            </div>
            <div className="bg-muted/30 border border-border p-3">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                Equilibrium
              </div>
              <div className="text-sm font-bold font-mono text-warning">
                {data.equilibrium.toFixed(decimals)}
              </div>
            </div>
            <div className="bg-muted/30 border border-border p-3">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                Zone %
              </div>
              <div className="text-sm font-bold font-mono text-foreground">
                {data.zonePercent.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Explanation */}
          <div className="text-[10px] font-mono text-muted-foreground bg-muted/20 p-2 border border-border/50">
            <strong className="text-foreground">ICT Premium/Discount:</strong>{" "}
            Price above the 50% equilibrium is in the{" "}
            <span className="text-bearish">premium zone</span> (ideal for
            sells). Price below is in the{" "}
            <span className="text-bullish">discount zone</span> (ideal for
            buys). The <span className="text-cyan">OTE zone (62-79%)</span> is
            the Optimal Trade Entry area for retracements.
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// FUNDAMENTALS PANEL
// ═══════════════════════════════════════════════════════════════════════
function FundamentalsPanel({
  selectedSymbol,
  expanded,
  onToggle,
}: {
  selectedSymbol: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const fundamentals = trpc.fundamentals.data.useQuery(undefined, {
    refetchInterval: 300000,
  });
  const pairEvents = trpc.fundamentals.eventsForPair.useQuery(
    { pair: selectedSymbol },
    { refetchInterval: 300000 }
  );
  const highImpact = trpc.fundamentals.highImpactCheck.useQuery(
    { pair: selectedSymbol, withinMinutes: 60 },
    { refetchInterval: 60000 }
  );

  const impactColor = (impact: string) => {
    switch (impact) {
      case "high":
        return "text-bearish bg-bearish/10 border-bearish/30";
      case "medium":
        return "text-warning bg-warning/10 border-warning/30";
      default:
        return "text-muted-foreground bg-muted/10 border-border";
    }
  };

  const impactDot = (impact: string) => {
    switch (impact) {
      case "high":
        return "bg-bearish";
      case "medium":
        return "bg-warning";
      default:
        return "bg-muted-foreground";
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const countryFlag = (country: string) => {
    const flags: Record<string, string> = {
      US: "\u{1F1FA}\u{1F1F8}",
      EU: "\u{1F1EA}\u{1F1FA}",
      GB: "\u{1F1EC}\u{1F1E7}",
      JP: "\u{1F1EF}\u{1F1F5}",
      AU: "\u{1F1E6}\u{1F1FA}",
      CA: "\u{1F1E8}\u{1F1E6}",
      NZ: "\u{1F1F3}\u{1F1FF}",
      CH: "\u{1F1E8}\u{1F1ED}",
      CN: "\u{1F1E8}\u{1F1F3}",
    };
    return flags[country] || country;
  };

  // Render a single event row with forecast/previous/actual data
  const EventRow = ({ event, showDate = false }: { event: any; showDate?: boolean }) => (
    <div className="bg-muted/20 border border-border/50 px-3 py-2">
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full flex-shrink-0 ${impactDot(event.impact)}`}
        />
        <div className="text-[10px] font-mono w-8 flex-shrink-0">
          {countryFlag(event.country)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-mono font-bold text-foreground truncate">
            {event.name}
          </div>
          <div className="text-[10px] font-mono text-muted-foreground">
            {showDate && <>{formatDate(event.scheduledTime)} at{" "}</>}
            {formatTime(event.scheduledTime)}
            {event.currency && (
              <span className="ml-1 text-cyan">({event.currency})</span>
            )}
          </div>
        </div>
        <span
          className={`text-[9px] font-mono font-bold px-1.5 py-0.5 border ${impactColor(
            event.impact
          )} uppercase`}
        >
          {event.impact}
        </span>
      </div>
      {/* Forecast / Previous / Actual row */}
      {(event.forecast || event.previous || event.actual) && (
        <div className="flex items-center gap-3 mt-1.5 ml-6 text-[10px] font-mono">
          {event.forecast && (
            <span className="text-muted-foreground">
              Forecast: <span className="text-foreground font-bold">{event.forecast}</span>
            </span>
          )}
          {event.previous && (
            <span className="text-muted-foreground">
              Previous: <span className="text-foreground">{event.previous}</span>
            </span>
          )}
          {event.actual && (
            <span className="text-muted-foreground">
              Actual: <span className="text-bullish font-bold">{event.actual}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );

  return (
    <Panel
      id="fundamentals"
      title="Fundamentals / Economic Calendar"
      icon={<Calendar className="w-4 h-4" />}
      expanded={expanded}
      onToggle={onToggle}
    >
      {fundamentals.isLoading ? (
        <LoadingState />
      ) : fundamentals.data ? (
        <div className="space-y-4">
          {/* Data source indicator */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full ${
                  (fundamentals.data as any).dataSource === "live"
                    ? "bg-bullish/20 text-bullish border border-bullish/30"
                    : "bg-warning/20 text-warning border border-warning/30"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    (fundamentals.data as any).dataSource === "live"
                      ? "bg-bullish animate-pulse"
                      : "bg-warning"
                  }`}
                />
                {(fundamentals.data as any).dataSource === "live" ? "LIVE DATA" : "SCHEDULE"}
              </span>
            </div>
            {(fundamentals.data as any).lastUpdated && (
              <span className="text-[9px] font-mono text-muted-foreground">
                Updated: {formatTime((fundamentals.data as any).lastUpdated)}
              </span>
            )}
          </div>

          {/* High impact alert */}
          {highImpact.data?.hasEvent && highImpact.data.event && (
            <div className="bg-bearish/10 border border-bearish/30 p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-bearish flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold font-mono text-bearish">
                  HIGH IMPACT EVENT APPROACHING
                </div>
                <div className="text-[10px] font-mono text-foreground mt-1">
                  {highImpact.data.event.name} ({highImpact.data.event.currency}
                  ) at {formatTime(highImpact.data.event.scheduledTime)}
                </div>
                <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                  {highImpact.data.event.description}
                </div>
                {(highImpact.data.event as any).forecast && (
                  <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                    Forecast: <span className="text-foreground font-bold">{(highImpact.data.event as any).forecast}</span>
                    {(highImpact.data.event as any).previous && (
                      <> | Previous: <span className="text-foreground">{(highImpact.data.event as any).previous}</span></>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Impact summary */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-bearish/10 border border-bearish/30 p-2.5 text-center">
              <div className="text-lg font-bold font-mono text-bearish">
                {fundamentals.data.highImpactCount}
              </div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-wider">
                High Impact
              </div>
            </div>
            <div className="bg-warning/10 border border-warning/30 p-2.5 text-center">
              <div className="text-lg font-bold font-mono text-warning">
                {fundamentals.data.mediumImpactCount}
              </div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-wider">
                Medium Impact
              </div>
            </div>
            <div className="bg-muted/30 border border-border p-2.5 text-center">
              <div className="text-lg font-bold font-mono text-muted-foreground">
                {fundamentals.data.lowImpactCount}
              </div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-wider">
                Low Impact
              </div>
            </div>
          </div>

          {/* Currency exposure */}
          {Object.keys(fundamentals.data.currencyExposure).length > 0 && (
            <div>
              <div className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Currency Event Exposure (This Week)
              </div>
              <div className="grid grid-cols-4 gap-1">
                {Object.entries(fundamentals.data.currencyExposure)
                  .sort(
                    ([, a], [, b]) =>
                      (b as any).high * 3 + (b as any).medium * 2 + (b as any).low -
                      ((a as any).high * 3 + (a as any).medium * 2 + (a as any).low)
                  )
                  .map(([currency, counts]) => (
                    <div
                      key={currency}
                      className="bg-muted/20 border border-border p-2 text-center"
                    >
                      <div className="text-xs font-bold font-mono text-foreground">
                        {currency}
                      </div>
                      <div className="flex justify-center gap-1 mt-1">
                        {(counts as any).high > 0 && (
                          <span className="text-[9px] font-mono text-bearish">
                            {(counts as any).high}H
                          </span>
                        )}
                        {(counts as any).medium > 0 && (
                          <span className="text-[9px] font-mono text-warning">
                            {(counts as any).medium}M
                          </span>
                        )}
                        {(counts as any).low > 0 && (
                          <span className="text-[9px] font-mono text-muted-foreground">
                            {(counts as any).low}L
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Events for selected pair */}
          <div>
            <div className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Events Affecting {selectedSymbol} (Next 7 Days)
            </div>
            {pairEvents.data && pairEvents.data.length > 0 ? (
              <div className="space-y-1">
                {pairEvents.data.slice(0, 20).map((event: any, i: number) => (
                  <EventRow key={i} event={event} showDate />
                ))}
              </div>
            ) : (
              <div className="text-xs font-mono text-muted-foreground py-2">
                No events affecting {selectedSymbol} in the next 7 days
              </div>
            )}
          </div>

          {/* Today's events */}
          <div>
            <div className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Today&apos;s Events ({fundamentals.data.todayEvents.length})
            </div>
            {fundamentals.data.todayEvents.length > 0 ? (
              <div className="space-y-1">
                {fundamentals.data.todayEvents.map((event: any, i: number) => (
                  <EventRow key={i} event={event} />
                ))}
              </div>
            ) : (
              <div className="text-xs font-mono text-muted-foreground py-2">
                No economic events scheduled for today
              </div>
            )}
          </div>

          {/* Explanation */}
          <div className="text-[10px] font-mono text-muted-foreground bg-muted/20 p-2 border border-border/50">
            <strong className="text-foreground">Fundamentals Calendar:</strong>{" "}
            {(fundamentals.data as any).dataSource === "live"
              ? "Showing live economic calendar data from ForexFactory. Events update every 15 minutes."
              : "Showing schedule-based events. Live data feed unavailable."}{" "}
            <span className="text-bearish">High impact</span> events (NFP, CPI,
            central bank decisions) often cause 50-200+ pip moves. The bot&apos;s
            news filter can automatically pause trading before these events.
          </div>
        </div>
      ) : (
        <EmptyState text="Fundamentals data unavailable" />
      )}
    </Panel>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SHARED SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════

function Panel({
  id,
  title,
  icon,
  expanded,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          )}
          <span className="text-cyan">{icon}</span>
          <span className="text-sm font-bold font-mono text-foreground uppercase tracking-wider">
            {title}
          </span>
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t border-border/50">
          <div className="pt-3">{children}</div>
        </div>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center gap-2 py-4">
      <div className="w-4 h-4 border-2 border-cyan border-t-transparent rounded-full animate-spin" />
      <span className="text-xs font-mono text-muted-foreground">
        Loading data...
      </span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-4 text-center text-xs font-mono text-muted-foreground">
      {text}
    </div>
  );
}
