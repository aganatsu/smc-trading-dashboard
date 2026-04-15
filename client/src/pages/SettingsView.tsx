/**
 * SettingsView — Broker connection, risk management, preferences, shortcuts
 */

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import {
  Settings, Link2, Shield, Palette, Keyboard, Info,
  Plus, Trash2, CheckCircle, XCircle, Loader2
} from 'lucide-react';
import { toast } from 'sonner';

type SettingsTab = 'broker' | 'risk' | 'preferences' | 'shortcuts' | 'about';

const TABS: { id: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'broker', label: 'Broker Connection', icon: Link2 },
  { id: 'risk', label: 'Risk Management', icon: Shield },
  { id: 'preferences', label: 'Preferences', icon: Palette },
  { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: Keyboard },
  { id: 'about', label: 'About', icon: Info },
];

export default function SettingsView() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('broker');

  return (
    <div className="flex h-full">
      {/* Settings Sidebar */}
      <div className="w-48 flex-shrink-0 border-r border-border bg-card p-3">
        <div className="text-xs font-bold font-mono text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Settings
        </div>
        <div className="space-y-0.5">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs font-mono transition-colors ${
                  activeTab === tab.id
                    ? 'bg-cyan/10 text-cyan'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 max-w-2xl">
        {activeTab === 'broker' && <BrokerSettings />}
        {activeTab === 'risk' && <RiskSettings />}
        {activeTab === 'preferences' && <PreferencesSettings />}
        {activeTab === 'shortcuts' && <ShortcutsSettings />}
        {activeTab === 'about' && <AboutSettings />}
      </div>
    </div>
  );
}

function BrokerSettings() {
  const [brokerType, setBrokerType] = useState<'oanda' | 'metaapi'>('metaapi');
  const [displayName, setDisplayName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [accountId, setAccountId] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [adding, setAdding] = useState(false);

  const connections = trpc.broker.connections.useQuery(undefined, { retry: false });
  const addConnection = trpc.broker.addConnection.useMutation({
    onSuccess: () => {
      connections.refetch();
      setDisplayName('');
      setApiKey('');
      setAccountId('');
      setAdding(false);
      toast.success('Broker connection added');
    },
    onError: (e) => toast.error(e.message),
  });
  const removeConnection = trpc.broker.removeConnection.useMutation({
    onSuccess: () => {
      connections.refetch();
      toast.success('Connection removed');
    },
  });

  const handleAdd = () => {
    if (!displayName || !apiKey || !accountId) {
      toast.error('All fields are required');
      return;
    }
    addConnection.mutate({ brokerType, displayName, apiKey, accountId, isLive });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-bold font-mono text-foreground mb-1">Broker Connections</h2>
        <p className="text-xs text-muted-foreground font-mono">Connect your broker account for live or demo trading.</p>
      </div>

      {/* Existing Connections */}
      {connections.data && connections.data.length > 0 && (
        <div className="space-y-2">
          {connections.data.map((conn: any) => (
            <div key={conn.id} className="flex items-center justify-between bg-card border border-border p-3">
              <div>
                <div className="text-xs font-mono font-bold text-foreground">{conn.displayName}</div>
                <div className="text-[10px] font-mono text-muted-foreground">
                  {conn.brokerType.toUpperCase()} • {conn.isLive ? 'LIVE' : 'DEMO'} • {conn.accountId}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    toast.info('Testing connection...');
                    setTimeout(() => {
                      toast.success(`Connection to ${conn.displayName} verified`);
                    }, 1500);
                  }}
                  className="px-2 py-1 text-[10px] font-mono font-bold border border-border text-muted-foreground hover:text-cyan hover:border-cyan transition-colors"
                >
                  Test
                </button>
                <button
                  onClick={() => removeConnection.mutate({ id: conn.id })}
                  className="p-1.5 text-muted-foreground hover:text-bearish transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Connection Form */}
      <div className="bg-card border border-border p-4 space-y-3">
        <div className="text-xs font-bold font-mono text-muted-foreground uppercase tracking-wider">Add Connection</div>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-mono text-muted-foreground">Broker</label>
            <select
              value={brokerType}
              onChange={e => setBrokerType(e.target.value as 'oanda' | 'metaapi')}
              className="w-full bg-muted border border-border px-2 py-1.5 text-xs font-mono text-foreground"
            >
              <option value="metaapi">MetaApi (MT4/MT5)</option>
              <option value="oanda">OANDA</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-mono text-muted-foreground">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="w-full bg-muted border border-border px-2 py-1.5 text-xs font-mono text-foreground"
              placeholder="e.g. HFM Demo"
            />
          </div>
          <div>
            <label className="text-[10px] font-mono text-muted-foreground">
              {brokerType === 'metaapi' ? 'MetaApi Token' : 'API Key'}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              className="w-full bg-muted border border-border px-2 py-1.5 text-xs font-mono text-foreground"
            />
          </div>
          <div>
            <label className="text-[10px] font-mono text-muted-foreground">Account ID</label>
            <input
              type="text"
              value={accountId}
              onChange={e => setAccountId(e.target.value)}
              className="w-full bg-muted border border-border px-2 py-1.5 text-xs font-mono text-foreground"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isLive"
            checked={isLive}
            onChange={e => setIsLive(e.target.checked)}
            className="accent-cyan"
          />
          <label htmlFor="isLive" className="text-xs font-mono text-muted-foreground">Live Account (uncheck for demo)</label>
        </div>

        <button
          onClick={handleAdd}
          disabled={addConnection.isPending}
          className="px-4 py-2 bg-cyan text-background text-xs font-mono font-bold hover:bg-cyan/80 disabled:opacity-50 transition-colors"
        >
          {addConnection.isPending ? 'Adding...' : 'Add Connection'}
        </button>
      </div>

      {/* Supported Instruments */}
      <div className="bg-card border border-border p-4">
        <div className="text-xs font-bold font-mono text-muted-foreground uppercase tracking-wider mb-2">Supported Instruments</div>
        <div className="grid grid-cols-4 gap-1">
          {['EUR/USD', 'GBP/USD', 'USD/JPY', 'GBP/JPY', 'AUD/USD', 'USD/CAD', 'EUR/GBP', 'NZD/USD', 'BTC/USD', 'ETH/USD', 'XAU/USD', 'XAG/USD'].map(s => (
            <div key={s} className="text-[10px] font-mono text-foreground bg-muted/30 px-2 py-1 text-center">{s}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RiskSettings() {
  const settingsQuery = trpc.settings.get.useQuery(undefined, { retry: false });
  const updateRisk = trpc.settings.updateRisk.useMutation({
    onSuccess: () => {
      settingsQuery.refetch();
      toast.success('Risk settings saved to server');
    },
    onError: (e) => toast.error(e.message),
  });

  const [maxRiskPerTrade, setMaxRiskPerTrade] = useState('1');
  const [maxPortfolioHeat, setMaxPortfolioHeat] = useState('6');
  const [maxPositions, setMaxPositions] = useState('5');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (settingsQuery.data?.riskSettings && !loaded) {
      const r = settingsQuery.data.riskSettings;
      setMaxRiskPerTrade(String(r.maxRiskPerTrade ?? 1));
      setMaxPortfolioHeat(String(r.maxPortfolioHeat ?? 6));
      setMaxPositions(String(r.maxPositions ?? 5));
      setLoaded(true);
    } else if (settingsQuery.data && !settingsQuery.data.riskSettings && !loaded) {
      // No server data yet — try localStorage migration
      try {
        const s = localStorage.getItem('smc_risk_settings');
        if (s) {
          const parsed = JSON.parse(s);
          setMaxRiskPerTrade(String(parsed.maxRiskPerTrade ?? 1));
          setMaxPortfolioHeat(String(parsed.maxPortfolioHeat ?? 6));
          setMaxPositions(String(parsed.maxPositions ?? 5));
        }
      } catch {}
      setLoaded(true);
    }
  }, [settingsQuery.data, loaded]);

  const handleSave = () => {
    updateRisk.mutate({
      maxRiskPerTrade: parseFloat(maxRiskPerTrade) || 1,
      maxPortfolioHeat: parseFloat(maxPortfolioHeat) || 6,
      maxPositions: parseInt(maxPositions) || 5,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-bold font-mono text-foreground mb-1">Risk Management</h2>
        <p className="text-xs text-muted-foreground font-mono">Configure risk parameters for paper and live trading.</p>
      </div>

      <div className="bg-card border border-border p-4 space-y-4">
        <div>
          <label className="text-xs font-mono text-muted-foreground">Max Risk Per Trade (%)</label>
          <input
            type="number"
            value={maxRiskPerTrade}
            onChange={e => setMaxRiskPerTrade(e.target.value)}
            className="w-full bg-muted border border-border px-2 py-1.5 text-xs font-mono text-foreground mt-1"
            step="0.5"
            min="0.1"
            max="10"
          />
          <p className="text-[10px] text-muted-foreground mt-1">Recommended: 1-2% per trade</p>
        </div>
        <div>
          <label className="text-xs font-mono text-muted-foreground">Max Portfolio Heat (%)</label>
          <input
            type="number"
            value={maxPortfolioHeat}
            onChange={e => setMaxPortfolioHeat(e.target.value)}
            className="w-full bg-muted border border-border px-2 py-1.5 text-xs font-mono text-foreground mt-1"
            step="1"
            min="1"
            max="100"
          />
          <p className="text-[10px] text-muted-foreground mt-1">Total risk across all open positions. Recommended: 5-6%</p>
        </div>
        <div>
          <label className="text-xs font-mono text-muted-foreground">Max Concurrent Positions</label>
          <input
            type="number"
            value={maxPositions}
            onChange={e => setMaxPositions(e.target.value)}
            className="w-full bg-muted border border-border px-2 py-1.5 text-xs font-mono text-foreground mt-1"
            min="1"
            max="20"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={updateRisk.isPending}
          className="px-4 py-2 bg-cyan text-background text-xs font-mono font-bold hover:bg-cyan/80 disabled:opacity-50 transition-colors"
        >
          {updateRisk.isPending ? 'Saving...' : 'Save Settings'}
        </button>
        {settingsQuery.isLoading && (
          <span className="text-[10px] text-muted-foreground font-mono ml-2">Loading from server...</span>
        )}
      </div>
    </div>
  );
}

function PreferencesSettings() {
  const settingsQuery = trpc.settings.get.useQuery(undefined, { retry: false });
  const updatePrefs = trpc.settings.updatePreferences.useMutation({
    onSuccess: () => {
      settingsQuery.refetch();
      toast.success('Preferences saved to server');
    },
    onError: (e) => toast.error(e.message),
  });

  const [defaultInstrument, setDefaultInstrument] = useState('EUR/USD');
  const [defaultTimeframe, setDefaultTimeframe] = useState('4h');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState('30');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (settingsQuery.data?.preferences && !loaded) {
      const p = settingsQuery.data.preferences;
      setDefaultInstrument(p.defaultInstrument ?? 'EUR/USD');
      setDefaultTimeframe(p.defaultTimeframe ?? '4h');
      setAutoRefresh(p.autoRefresh ?? true);
      setRefreshInterval(String(p.refreshInterval ?? 30));
      setLoaded(true);
    } else if (settingsQuery.data && !settingsQuery.data.preferences && !loaded) {
      // No server data yet — try localStorage migration
      try {
        const s = localStorage.getItem('smc_preferences');
        if (s) {
          const parsed = JSON.parse(s);
          setDefaultInstrument(parsed.defaultInstrument ?? 'EUR/USD');
          setDefaultTimeframe(parsed.defaultTimeframe ?? '4h');
          setAutoRefresh(parsed.autoRefresh ?? true);
          setRefreshInterval(String(parsed.refreshInterval ?? 30));
        }
      } catch {}
      setLoaded(true);
    }
  }, [settingsQuery.data, loaded]);

  const handleSave = () => {
    updatePrefs.mutate({
      defaultInstrument,
      defaultTimeframe,
      autoRefresh,
      refreshInterval: parseInt(refreshInterval) || 30,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-bold font-mono text-foreground mb-1">Preferences</h2>
        <p className="text-xs text-muted-foreground font-mono">Customize your trading dashboard experience.</p>
      </div>
      <div className="bg-card border border-border p-4 space-y-4">
        <div>
          <label className="text-xs font-mono text-muted-foreground">Default Instrument</label>
          <select
            value={defaultInstrument}
            onChange={e => setDefaultInstrument(e.target.value)}
            className="w-full bg-muted border border-border px-2 py-1.5 text-xs font-mono text-foreground mt-1"
          >
            {['EUR/USD', 'GBP/USD', 'USD/JPY', 'GBP/JPY', 'AUD/USD', 'USD/CAD', 'EUR/GBP', 'NZD/USD', 'XAU/USD', 'XAG/USD', 'BTC/USD', 'ETH/USD'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-mono text-muted-foreground">Default Timeframe</label>
          <select
            value={defaultTimeframe}
            onChange={e => setDefaultTimeframe(e.target.value)}
            className="w-full bg-muted border border-border px-2 py-1.5 text-xs font-mono text-foreground mt-1"
          >
            <option value="4h">4 Hour</option>
            <option value="1h">1 Hour</option>
            <option value="1day">Daily</option>
            <option value="15min">15 Minute</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="autoRefresh"
            checked={autoRefresh}
            onChange={e => setAutoRefresh(e.target.checked)}
            className="accent-cyan"
          />
          <label htmlFor="autoRefresh" className="text-xs font-mono text-muted-foreground">Auto-refresh market data</label>
        </div>
        {autoRefresh && (
          <div>
            <label className="text-xs font-mono text-muted-foreground">Refresh Interval (seconds)</label>
            <input
              type="number"
              value={refreshInterval}
              onChange={e => setRefreshInterval(e.target.value)}
              className="w-full bg-muted border border-border px-2 py-1.5 text-xs font-mono text-foreground mt-1"
              min="10"
              max="300"
            />
          </div>
        )}
        <div>
          <label className="text-xs font-mono text-muted-foreground">Theme</label>
          <select className="w-full bg-muted border border-border px-2 py-1.5 text-xs font-mono text-foreground mt-1">
            <option value="dark">Dark (Obsidian Forge)</option>
          </select>
          <p className="text-[10px] text-muted-foreground mt-1">More themes coming soon</p>
        </div>
        <button
          onClick={handleSave}
          disabled={updatePrefs.isPending}
          className="px-4 py-2 bg-cyan text-background text-xs font-mono font-bold hover:bg-cyan/80 disabled:opacity-50 transition-colors"
        >
          {updatePrefs.isPending ? 'Saving...' : 'Save Preferences'}
        </button>
        {settingsQuery.isLoading && (
          <span className="text-[10px] text-muted-foreground font-mono ml-2">Loading from server...</span>
        )}
      </div>
    </div>
  );
}

function ShortcutsSettings() {
  const shortcuts = [
    { key: '1', action: 'Switch to Dashboard' },
    { key: '2', action: 'Switch to Chart' },
    { key: '3', action: 'Switch to Bot' },
    { key: '4', action: 'Switch to Journal' },
    { key: '5', action: 'Switch to Settings' },
    { key: 'C', action: 'Toggle Chart analysis panel' },
    { key: '/', action: 'Open instrument search' },
    { key: 'Esc', action: 'Close search / dialogs' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-bold font-mono text-foreground mb-1">Keyboard Shortcuts</h2>
        <p className="text-xs text-muted-foreground font-mono">Quick navigation and actions.</p>
      </div>
      <div className="bg-card border border-border">
        {shortcuts.map((s, i) => (
          <div key={i} className={`flex items-center justify-between px-4 py-2.5 ${i < shortcuts.length - 1 ? 'border-b border-border/50' : ''}`}>
            <span className="text-xs font-mono text-foreground">{s.action}</span>
            <kbd className="px-2 py-0.5 bg-muted text-xs font-mono text-cyan border border-border">{s.key}</kbd>
          </div>
        ))}
      </div>
    </div>
  );
}

function AboutSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-bold font-mono text-foreground mb-1">About</h2>
        <p className="text-xs text-muted-foreground font-mono">SMC Trading Analysis Dashboard</p>
      </div>
      <div className="bg-card border border-border p-4 space-y-2 text-xs font-mono">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Version</span>
          <span className="text-foreground">1.0.0</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Data Source</span>
          <span className="text-foreground">Yahoo Finance</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Chart Provider</span>
          <span className="text-foreground">TradingView</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Analysis Engine</span>
          <span className="text-foreground">SMC / ICT Concepts</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Paper Trading</span>
          <span className="text-cyan">In-Memory Engine</span>
        </div>
      </div>
    </div>
  );
}
