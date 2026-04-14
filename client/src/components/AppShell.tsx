/**
 * AppShell — Main application layout
 * Left icon rail (48px) + main content area + bottom status bar
 * 5 views: Dashboard, Chart, Bot, Journal, Settings
 * Lazy-mounted with display:none/block to preserve state across tab switches
 * Features: keyboard shortcuts (1-5), sidebar filter (/ shortcut), macOS padding
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LayoutDashboard, LineChart, Bot, BookOpen, Settings,
  Wifi, WifiOff, Clock, Activity, Search
} from 'lucide-react';

// View imports
import DashboardView from '@/pages/DashboardView';
import ChartView from '@/pages/ChartView';
import BotView from '@/pages/BotView';
import JournalView from '@/pages/JournalView';
import SettingsView from '@/pages/SettingsView';

export type ViewId = 'dashboard' | 'chart' | 'bot' | 'journal' | 'settings';

interface NavItem {
  id: ViewId;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  shortcut: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', shortcut: '1' },
  { id: 'chart', icon: LineChart, label: 'Chart', shortcut: '2' },
  { id: 'bot', icon: Bot, label: 'Bot', shortcut: '3' },
  { id: 'journal', icon: BookOpen, label: 'Journal', shortcut: '4' },
  { id: 'settings', icon: Settings, label: 'Settings', shortcut: '5' },
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

  // Keyboard shortcuts
  useEffect(() => {
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
      if (!isFilterInput && key >= '1' && key <= '5') {
        e.preventDefault();
        const idx = parseInt(key) - 1;
        switchView(NAV_ITEMS[idx].id);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [switchView, filterOpen]);

  // Periodic connection check
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(new Date());
      fetch('/api/trpc/market.quote?input=' + encodeURIComponent(JSON.stringify({ json: { symbol: 'EUR/USD' } })))
        .then(r => setConnectionStatus(r.ok ? 'connected' : 'disconnected'))
        .catch(() => setConnectionStatus('disconnected'));
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT ICON RAIL */}
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

        {/* FILTER PANEL (slides out from left rail) */}
        {filterOpen && (
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
          {mountedViews.has('settings') && (
            <div className="absolute inset-0 overflow-auto" style={{ display: activeView === 'settings' ? 'block' : 'none' }}>
              <SettingsView />
            </div>
          )}
        </main>
      </div>

      {/* BOTTOM STATUS BAR */}
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
        <span>Yahoo Finance</span>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3" />
          <span>{lastUpdate.toLocaleTimeString()}</span>
        </div>
      </footer>
    </div>
  );
}
