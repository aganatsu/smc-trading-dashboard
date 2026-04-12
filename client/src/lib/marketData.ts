/**
 * Market Data Service — Yahoo Finance via Backend tRPC
 * 
 * Design: Obsidian Forge — Dark Brutalist Trading Interface
 * No API key required — data is fetched server-side via Yahoo Finance.
 */

import type { Candle } from './smcAnalysis';

export interface Instrument {
  symbol: string;
  name: string;
  type: 'forex' | 'crypto' | 'commodity';
  displaySymbol: string;
}

export const INSTRUMENTS: Instrument[] = [
  { symbol: 'EUR/USD', name: 'Euro / US Dollar', type: 'forex', displaySymbol: 'EURUSD' },
  { symbol: 'GBP/USD', name: 'British Pound / US Dollar', type: 'forex', displaySymbol: 'GBPUSD' },
  { symbol: 'USD/JPY', name: 'US Dollar / Japanese Yen', type: 'forex', displaySymbol: 'USDJPY' },
  { symbol: 'GBP/JPY', name: 'British Pound / Japanese Yen', type: 'forex', displaySymbol: 'GBPJPY' },
  { symbol: 'AUD/USD', name: 'Australian Dollar / US Dollar', type: 'forex', displaySymbol: 'AUDUSD' },
  { symbol: 'USD/CAD', name: 'US Dollar / Canadian Dollar', type: 'forex', displaySymbol: 'USDCAD' },
  { symbol: 'EUR/GBP', name: 'Euro / British Pound', type: 'forex', displaySymbol: 'EURGBP' },
  { symbol: 'NZD/USD', name: 'New Zealand Dollar / US Dollar', type: 'forex', displaySymbol: 'NZDUSD' },
  { symbol: 'BTC/USD', name: 'Bitcoin / US Dollar', type: 'crypto', displaySymbol: 'BTCUSD' },
  { symbol: 'ETH/USD', name: 'Ethereum / US Dollar', type: 'crypto', displaySymbol: 'ETHUSD' },
  { symbol: 'XAU/USD', name: 'Gold / US Dollar', type: 'commodity', displaySymbol: 'XAUUSD' },
  { symbol: 'XAG/USD', name: 'Silver / US Dollar', type: 'commodity', displaySymbol: 'XAGUSD' },
];

export type Timeframe = '1week' | '1day' | '4h' | '1h' | '15min' | '5min';

export const TIMEFRAMES: { value: Timeframe; label: string; shortLabel: string }[] = [
  { value: '1week', label: 'Weekly', shortLabel: 'W' },
  { value: '1day', label: 'Daily', shortLabel: 'D' },
  { value: '4h', label: '4 Hour', shortLabel: '4H' },
  { value: '1h', label: '1 Hour', shortLabel: '1H' },
  { value: '15min', label: '15 Minute', shortLabel: '15m' },
  { value: '5min', label: '5 Minute', shortLabel: '5m' },
];

// Direct fetch functions that call the backend API via tRPC-compatible endpoint
export async function fetchCandles(
  symbol: string,
  interval: Timeframe,
  outputsize: number = 200,
): Promise<Candle[]> {
  const response = await fetch('/api/trpc/market.candles?input=' + encodeURIComponent(
    JSON.stringify({ json: { symbol, interval, outputsize } })
  ));
  
  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error.message || 'Failed to fetch data');
  }
  
  const result = data?.result?.data?.json;
  if (!result || !Array.isArray(result)) {
    throw new Error('No data returned from API');
  }
  
  return result;
}

// Fetch current quote via backend
export async function fetchQuote(symbol: string): Promise<{
  price: number;
  change: number;
  percentChange: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
}> {
  const response = await fetch('/api/trpc/market.quote?input=' + encodeURIComponent(
    JSON.stringify({ json: { symbol } })
  ));
  
  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error.message || 'Failed to fetch quote');
  }
  
  return data?.result?.data?.json;
}
