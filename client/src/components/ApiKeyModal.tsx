/**
 * ApiKeyModal — Settings modal for Twelve Data API key
 * Design: Obsidian Forge — Dark Brutalist Trading Interface
 */

import { useState } from 'react';
import { getApiKey, hasCustomApiKey } from '@/lib/marketData';
import { X, Key, ExternalLink } from 'lucide-react';

interface Props {
  onClose: () => void;
  onSave: (key: string) => void;
}

export default function ApiKeyModal({ onClose, onSave }: Props) {
  const [apiKey, setApiKey] = useState(hasCustomApiKey() ? getApiKey() : '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="w-full max-w-md bg-card border-4 border-border">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b-4 border-border">
          <div className="flex items-center gap-3">
            <Key className="w-5 h-5 text-cyan" />
            <span className="text-sm font-bold uppercase tracking-[0.1em] text-foreground">Settings</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-6">
          <div>
            <div className="section-label mb-3">TWELVE DATA API KEY</div>
            <p className="text-[11px] text-muted-foreground mb-4">
              Get a free API key from Twelve Data to access real-time market data for all instruments. 
              The demo key has limited access.
            </p>
            <input
              type="text"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="Enter your API key..."
              className="w-full bg-muted px-4 py-3 text-sm font-mono text-foreground placeholder:text-muted-foreground outline-none border-l-3 border-l-cyan focus:bg-muted/80 transition-colors"
            />
          </div>

          <a
            href="https://twelvedata.com/register"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-[11px] text-cyan hover:text-cyan/80 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Get a free API key at twelvedata.com
          </a>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t-4 border-border">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(apiKey || 'demo')}
            className="flex-1 py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground bg-primary hover:opacity-90 transition-opacity"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
