/**
 * Market Data Service — Twelve Data API
 * 
 * Design: Obsidian Forge — Dark Brutalist Trading Interface
 * Fetches OHLCV data for Forex, Crypto, and Commodities.
 */

import type { Candle } from './smcAnalysis';

const BASE_URL = 'https://api.twelvedata.com';

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

// API key storage
const API_KEY_STORAGE = 'smc_twelve_data_api_key';

export function getApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE) || 'demo';
}

export function setApiKey(key: string): void {
  localStorage.setItem(API_KEY_STORAGE, key);
}

export function hasCustomApiKey(): boolean {
  const key = localStorage.getItem(API_KEY_STORAGE);
  return !!key && key !== 'demo';
}

// Fetch OHLCV candle data
export async function fetchCandles(
  symbol: string,
  interval: Timeframe,
  outputsize: number = 200,
): Promise<Candle[]> {
  const apiKey = getApiKey();
  
  const params = new URLSearchParams({
    symbol,
    interval,
    outputsize: String(outputsize),
    apikey: apiKey,
  });
  
  const response = await fetch(`${BASE_URL}/time_series?${params}`);
  const data = await response.json();
  
  if (data.status === 'error') {
    throw new Error(data.message || 'Failed to fetch data');
  }
  
  if (!data.values || !Array.isArray(data.values)) {
    throw new Error('No data returned from API');
  }
  
  // Twelve Data returns newest first, reverse for chronological order
  return data.values
    .map((v: any) => ({
      datetime: v.datetime,
      open: parseFloat(v.open),
      high: parseFloat(v.high),
      low: parseFloat(v.low),
      close: parseFloat(v.close),
      volume: v.volume ? parseFloat(v.volume) : undefined,
    }))
    .reverse();
}

// Fetch current quote
export async function fetchQuote(symbol: string): Promise<{
  price: number;
  change: number;
  percentChange: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
}> {
  const apiKey = getApiKey();
  
  const params = new URLSearchParams({
    symbol,
    apikey: apiKey,
  });
  
  const response = await fetch(`${BASE_URL}/quote?${params}`);
  const data = await response.json();
  
  if (data.status === 'error') {
    throw new Error(data.message || 'Failed to fetch quote');
  }
  
  return {
    price: parseFloat(data.close),
    change: parseFloat(data.change),
    percentChange: parseFloat(data.percent_change),
    open: parseFloat(data.open),
    high: parseFloat(data.high),
    low: parseFloat(data.low),
    previousClose: parseFloat(data.previous_close),
  };
}
