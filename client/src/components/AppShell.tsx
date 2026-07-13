/**
 * AppShell — Main application layout
 * Desktop: Left icon rail (48px) + main content area + bottom status bar
 * Mobile (<768px): Full-width content + bottom tab bar (no left rail)
 * 7 views: Dashboard, Chart, ICT, Bot, Journal, Backtest, Settings
 * Lazy-mounted with display:none/block to preserve state across tab switches
 * Features: keyboard shortcuts (1-7), sidebar filter (/ shortcut), macOS padding, safe-area insets
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  LayoutDashboard, LineChart, Bot, BookOpen, Settings,
  Wifi, WifiOff, Clock, Activity, Search, FlaskConical
} from 'lucide-react';

import { useGlobalPriceFeed } from '@/hooks/useWebSocketPrices';
import { useIsMobile } from '@/hooks/useMobile';

// View imports
import DashboardView from '@/pages/DashboardView';
import ChartView from '@/pages/ChartView';
import BotView from '@/pages/BotView';
import JournalView from '@/pages/JournalView';
import SettingsView from '@/pages/SettingsView';
import ICTAnalysis from '@/pages/ICTAnalysis';
import BacktestView from '@/pages/BacktestView';

export type ViewId = 'dashboard' | 'chart' | 'ict' | 'bot' | 'journal' | 'backtest' | 'settings';

interface NavItem {
  id: ViewId;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  shortcut: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', shortcut: '1' },
  { id: 'chart', icon: LineChart, label: 'Chart', shortcut: '2' },
  { id: 'ict', icon: Activity, label: 'ICT', shortcut: '3' },
  { id: 'bot', icon: Bot, label: 'Bot', shortcut: '4' },
  { id: 'journal', icon: BookOpen, label: 'Journal', shortcut: '5' },
  { id: 'backtest', icon: FlaskConical, label: 'Backtest', shortcut: '6' },
  { id: 'settings', icon: Settings, label: 'Settings', shortcut: '7' },
];

// Mobile bottom bar shows 5 primary items (most used)
const MOBILE_NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Home', shortcut: '1' },
  { id: 'chart', icon: LineChart, label: 'Chart', shortcut: '2' },
  { id: 'bot', icon: Bot, label: 'Bot', shortcut: '4' },
  { id: 'journal', icon: BookOpen, label: 'Journal', shortcut: '5' },
  { id: 'settings', icon: Settings, label: 'More', shortcut: '7' },
];

// Instruments available for quick search/filter
const QUICK_SYMBOLS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'GBP/JPY', 'AUD/USD',
  'USD/CAD', 'EUR/GBP', 'NZD/USD', 'XAU/USD', 'XAG/USD',
  'BTC/USD', 'ETH/USD',
];

export default function AppShell() {
  const [activeView, setActiveView] = useState<ViewId>('dashboard');
  const [mountedViews, setMountedViews] = useState<Set<ViewId>>(() => new Set<ViewId>(['dashboard']));
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('connected');
  const isMobile = useIsMobile();

  // WebSocket real-time price feed
  const wsSymbols = useMemo(() => QUICK_SYMBOLS, []);
  const { connected: wsConnected, reconnecting: wsReconnecting } = useGlobalPriceFeed(wsSymbols);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const filterInputRef = useRef<HTMLInputElement>(null);

  // Track which views have been mounted (lazy mount)
  const switchView = useCallback((view: ViewId) => {
    setActiveView(view);
    setMountedViews(prev => {
      const next = new Set(prev);
      next.add(view);
      return next;
    });
  }, []);

  // Filtered symbols based on query
  const filteredSymbols = filterQuery
    ? QUICK_SYMBOLS.filter(s => s.toLowerCase().includes(filterQuery.toLowerCase()))
    : QUICK_SYMBOLS;

  // Select a symbol from filter — dispatch custom event so Chart/Bot views can pick it up
  const selectSymbol = useCallback((symbol: string) => {
    window.dispatchEvent(new CustomEvent('smc-symbol-change', { detail: { symbol } }));
    setFilterOpen(false);
    setFilterQuery('');
    // Auto-switch to chart view when selecting a symbol
    switchView('chart');
  }, [switchView]);

  // Keyboard shortcuts (desktop only)
  useEffect(() => {
    if (isMobile) return;
    const handler = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input (except our filter input)
      const target = e.target as HTMLElement;
      const isFilterInput = target === filterInputRef.current;
      
      if (!isFilterInput && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
        return;
      }

      const key = e.key;

      // Escape closes filter
      if (key === 'Escape' && filterOpen) {
        e.preventDefault();
        setFilterOpen(false);
        setFilterQuery('');
        filterInputRef.current?.blur();
        return;
      }

      // / opens filter (when not already in an input)
      if (key === '/' && !isFilterInput) {
        e.preventDefault();
        setFilterOpen(true);
        setTimeout(() => filterInputRef.current?.focus(), 50);
        return;
      }

      // Number keys for view switching (only when filter is not focused)
      if (!isFilterInput && key >= '1' && key <= '7') {
        e.preventDefault();
        const idx = parseInt(key) - 1;
        if (idx < NAV_ITEMS.length) switchView(NAV_ITEMS[idx].id);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [switchView, filterOpen, isMobile]);

  // Periodic connection check — use longer interval and derive status from WS
  useEffect(() => {
    setConnectionStatus(wsConnected ? 'connected' : 'disconnected');
  }, [wsConnected]);

  // Update clock display periodically (no network request)
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT ICON RAIL — Desktop only */}
        {!isMobile && (
          <nav className="w-12 flex-shrink-0 bg-card border-r border-border flex flex-col items-center pb-2" style={{ paddingTop: '28px' }}>
            {/* Logo */}
            <div className="mb-4 flex items-center justify-center">
              <Activity className="w-5 h-5 text-cyan" />
            </div>

            {/* Search/Filter button */}
            <button
              onClick={() => {
                setFilterOpen(!filterOpen);
                if (!filterOpen) {
                  setTimeout(() => filterInputRef.current?.focus(), 50);
                }
              }}
              title="Search instruments (/)"
              className={`w-10 h-10 flex items-center justify-center rounded-sm transition-all duration-150 mb-2 relative group ${
                filterOpen ? 'bg-cyan/10 text-cyan' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Search className="w-[18px] h-[18px]" />
              <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs font-mono rounded-sm opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-border">
                Search <span className="text-muted-foreground">/</span>
              </div>
            </button>

            <div className="w-6 h-px bg-border mb-2" />

            {/* Nav Icons */}
            <div className="flex flex-col gap-1 flex-1">
              {NAV_ITEMS.map(item => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => switchView(item.id)}
                    title={`${item.label} (${item.shortcut})`}
                    className={`
                      w-10 h-10 flex items-center justify-center rounded-sm transition-all duration-150 relative group
                      ${isActive
                        ? 'bg-cyan/10 text-cyan'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      }
                    `}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-cyan rounded-r" />
                    )}
                    <Icon className="w-[18px] h-[18px]" />
                    {/* Tooltip */}
                    <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs font-mono rounded-sm opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-border">
                      {item.label}
                      <span className="ml-2 text-muted-foreground">{item.shortcut}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </nav>
        )}

        {/* FILTER PANEL (slides out from left rail) — Desktop only */}
        {!isMobile && filterOpen && (
          <div className="w-48 flex-shrink-0 bg-card border-r border-border flex flex-col" style={{ paddingTop: '28px' }}>
            <div className="px-2 pb-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                <input
                  ref={filterInputRef}
                  type="text"
                  value={filterQuery}
                  onChange={e => setFilterQuery(e.target.value)}
                  placeholder="Search pair..."
                  className="w-full bg-muted border border-border pl-7 pr-2 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyan"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredSymbols.map(symbol => (
                <button
                  key={symbol}
                  onClick={() => selectSymbol(symbol)}
                  className="w-full text-left px-3 py-1.5 text-xs font-mono text-foreground hover:bg-muted transition-colors"
                >
                  {symbol}
                </button>
              ))}
              {filteredSymbols.length === 0 && (
                <div className="px-3 py-4 text-[10px] font-mono text-muted-foreground text-center">
                  No matches
                </div>
              )}
            </div>
          </div>
        )}

        {/* MAIN CONTENT — Lazy-mounted views */}
        <main className="flex-1 overflow-hidden relative">
          {mountedViews.has('dashboard') && (
            <div className="absolute inset-0 overflow-auto" style={{ display: activeView === 'dashboard' ? 'block' : 'none' }}>
              <DashboardView />
            </div>
          )}
          {mountedViews.has('chart') && (
            <div className="absolute inset-0 overflow-hidden" style={{ display: activeView === 'chart' ? 'flex' : 'none' }}>
              <ChartView />
            </div>
          )}
          {mountedViews.has('ict') && (
            <div className="absolute inset-0 overflow-hidden" style={{ display: activeView === 'ict' ? 'flex' : 'none' }}>
              <ICTAnalysis />
            </div>
          )}
          {mountedViews.has('bot') && (
            <div className="absolute inset-0 overflow-hidden" style={{ display: activeView === 'bot' ? 'flex' : 'none', flexDirection: 'column' }}>
              <BotView />
            </div>
          )}
          {mountedViews.has('journal') && (
            <div className="absolute inset-0 overflow-auto" style={{ display: activeView === 'journal' ? 'block' : 'none' }}>
              <JournalView />
            </div>
          )}
          {mountedViews.has('backtest') && (
            <div className="absolute inset-0 overflow-auto" style={{ display: activeView === 'backtest' ? 'block' : 'none' }}>
              <BacktestView />
            </div>
          )}
          {mountedViews.has('settings') && (
            <div className="absolute inset-0 overflow-auto" style={{ display: activeView === 'settings' ? 'block' : 'none' }}>
              <SettingsView />
            </div>
          )}
        </main>
      </div>

      {/* BOTTOM STATUS BAR — Desktop only */}
      {!isMobile && (
        <footer className="h-6 bg-card border-t border-border flex items-center px-3 gap-4 text-[10px] font-mono text-muted-foreground flex-shrink-0">
          <div className="flex items-center gap-1.5">
            {connectionStatus === 'connected' ? (
              <Wifi className="w-3 h-3 text-bullish" />
            ) : (
              <WifiOff className="w-3 h-3 text-bearish" />
            )}
            <span className={connectionStatus === 'connected' ? 'text-bullish' : 'text-bearish'}>
              {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div className="w-px h-3 bg-border" />
          <span>PAPER MODE</span>
          <div className="w-px h-3 bg-border" />
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-emerald-400 animate-pulse' : wsReconnecting ? 'bg-orange-400 animate-pulse' : 'bg-zinc-500'}`} />
            <span className={wsConnected ? 'text-emerald-400' : wsReconnecting ? 'text-orange-400' : 'text-zinc-500'}>
              {wsConnected ? 'WS Live' : wsReconnecting ? 'WS Reconnecting...' : 'WS Offline'}
            </span>
          </div>
          <div className="w-px h-3 bg-border" />
          <span>Yahoo Finance</span>
          <div className="flex-1" />
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            <span>{lastUpdate.toLocaleTimeString()}</span>
          </div>
        </footer>
      )}

      {/* MOBILE BOTTOM TAB BAR */}
      {isMobile && (
        <nav
          className="bg-card border-t border-border flex items-center justify-around flex-shrink-0"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)', minHeight: '56px' }}
        >
          {MOBILE_NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => switchView(item.id)}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 px-3 rounded-lg transition-colors min-w-[52px] ${
                  isActive
                    ? 'text-cyan'
                    : 'text-muted-foreground active:text-foreground'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className={`text-[10px] font-medium ${isActive ? 'text-cyan' : ''}`}>
                  {item.label}
                </span>
                {isActive && (
                  <div className="absolute bottom-1 w-4 h-0.5 bg-cyan rounded-full" />
                )}
              </button>
            );
          })}
          {/* Connection indicator dot — minimal mobile status */}
          <div className="absolute top-1 right-3">
            <span className={`w-1.5 h-1.5 rounded-full inline-block ${
              wsConnected ? 'bg-emerald-400' : wsReconnecting ? 'bg-orange-400 animate-pulse' : 'bg-zinc-500'
            }`} />
          </div>
        </nav>
      )}
    </div>
  );
}
