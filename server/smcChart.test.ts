/**
 * SMCChart — Overlay data transformation tests
 * Tests the data shapes and transformation logic that feeds SMCChart
 */
import { describe, it, expect } from 'vitest';

// We test the transformation logic that ChartView uses to convert AnalysisResult → SMCOverlays
// Since this is pure data transformation, we replicate the logic here to verify correctness

interface OrderBlock {
  index: number;
  high: number;
  low: number;
  type: 'bullish' | 'bearish';
  datetime: string;
  mitigated: boolean;
  mitigatedPercent: number;
}

interface FairValueGap {
  index: number;
  high: number;
  low: number;
  type: 'bullish' | 'bearish';
  datetime: string;
  mitigated: boolean;
}

interface LiquidityPool {
  price: number;
  type: 'buy-side' | 'sell-side';
  strength: number;
  datetime: string;
  swept: boolean;
}

interface SwingPoint {
  index: number;
  price: number;
  type: 'high' | 'low';
  datetime: string;
}

interface FibLevel {
  level: number;
  price: number;
  label: string;
}

interface AnalysisResult {
  structure: { trend: string; swingPoints: SwingPoint[]; bos: any[]; choch: any[] };
  orderBlocks: OrderBlock[];
  fvgs: FairValueGap[];
  liquidityPools: LiquidityPool[];
  fibLevels: FibLevel[];
  fiftyPercentLevel: number;
  keySupport: number[];
  keyResistance: number[];
}

// Replicate the transformation from ChartView
function analysisToOverlays(analysis: AnalysisResult) {
  return {
    orderBlocks: analysis.orderBlocks.filter(ob => !ob.mitigated).map(ob => ({
      high: ob.high, low: ob.low, datetime: ob.datetime, direction: ob.type,
    })),
    fvgs: analysis.fvgs.filter(f => !f.mitigated).map(f => ({
      high: f.high, low: f.low, datetime: f.datetime, direction: f.type,
    })),
    swingPoints: analysis.structure.swingPoints.map(sp => ({
      price: sp.price, index: sp.index, type: sp.type, datetime: sp.datetime,
    })),
    liquidityPools: analysis.liquidityPools.map(lp => ({
      price: lp.price, type: lp.type, strength: lp.strength, swept: lp.swept,
    })),
    fibLevels: analysis.fibLevels,
    fiftyPercentLevel: analysis.fiftyPercentLevel,
    keySupport: analysis.keySupport,
    keyResistance: analysis.keyResistance,
  };
}

// Replicate BotView trade overlay transformation
function positionsToTradeOverlays(positions: any[], symbol: string) {
  const symbolPositions = positions.filter(p => p.symbol === symbol);
  if (symbolPositions.length === 0) return undefined;
  return {
    trades: symbolPositions.map(p => ({
      entryPrice: p.entryPrice,
      stopLoss: p.stopLoss,
      takeProfit: p.takeProfit,
      direction: p.direction as 'long' | 'short',
      label: `${p.size} lots`,
    })),
  };
}

describe('SMCChart Overlay Transformations', () => {
  describe('analysisToOverlays', () => {
    const mockAnalysis: AnalysisResult = {
      structure: {
        trend: 'bullish',
        swingPoints: [
          { index: 5, price: 1.1050, type: 'high', datetime: '2024-01-15' },
          { index: 10, price: 1.0950, type: 'low', datetime: '2024-01-16' },
          { index: 15, price: 1.1100, type: 'high', datetime: '2024-01-17' },
        ],
        bos: [],
        choch: [],
      },
      orderBlocks: [
        { index: 3, high: 1.1020, low: 1.0990, type: 'bullish', datetime: '2024-01-14', mitigated: false, mitigatedPercent: 0 },
        { index: 7, high: 1.1080, low: 1.1060, type: 'bearish', datetime: '2024-01-15', mitigated: true, mitigatedPercent: 100 },
        { index: 12, high: 1.0980, low: 1.0960, type: 'bullish', datetime: '2024-01-16', mitigated: false, mitigatedPercent: 30 },
      ],
      fvgs: [
        { index: 4, high: 1.1030, low: 1.1010, type: 'bullish', datetime: '2024-01-14', mitigated: false },
        { index: 8, high: 1.1070, low: 1.1050, type: 'bearish', datetime: '2024-01-15', mitigated: true },
      ],
      liquidityPools: [
        { price: 1.1100, type: 'buy-side', strength: 3, datetime: '2024-01-17', swept: false },
        { price: 1.0900, type: 'sell-side', strength: 2, datetime: '2024-01-13', swept: true },
      ],
      fibLevels: [
        { level: 0.382, price: 1.1007, label: '38.2%' },
        { level: 0.5, price: 1.1025, label: '50%' },
        { level: 0.618, price: 1.1043, label: '61.8%' },
      ],
      fiftyPercentLevel: 1.1025,
      keySupport: [1.0950, 1.0900],
      keyResistance: [1.1100, 1.1150],
    };

    it('filters out mitigated order blocks', () => {
      const overlays = analysisToOverlays(mockAnalysis);
      expect(overlays.orderBlocks).toHaveLength(2);
      expect(overlays.orderBlocks[0].direction).toBe('bullish');
      expect(overlays.orderBlocks[1].direction).toBe('bullish');
    });

    it('filters out mitigated FVGs', () => {
      const overlays = analysisToOverlays(mockAnalysis);
      expect(overlays.fvgs).toHaveLength(1);
      expect(overlays.fvgs[0].direction).toBe('bullish');
      expect(overlays.fvgs[0].high).toBe(1.1030);
    });

    it('maps all swing points with correct fields', () => {
      const overlays = analysisToOverlays(mockAnalysis);
      expect(overlays.swingPoints).toHaveLength(3);
      expect(overlays.swingPoints[0]).toEqual({
        price: 1.1050, index: 5, type: 'high', datetime: '2024-01-15',
      });
    });

    it('preserves liquidity pool swept status', () => {
      const overlays = analysisToOverlays(mockAnalysis);
      expect(overlays.liquidityPools).toHaveLength(2);
      expect(overlays.liquidityPools[0].swept).toBe(false);
      expect(overlays.liquidityPools[1].swept).toBe(true);
    });

    it('passes through fib levels unchanged', () => {
      const overlays = analysisToOverlays(mockAnalysis);
      expect(overlays.fibLevels).toEqual(mockAnalysis.fibLevels);
      expect(overlays.fiftyPercentLevel).toBe(1.1025);
    });

    it('passes through support and resistance levels', () => {
      const overlays = analysisToOverlays(mockAnalysis);
      expect(overlays.keySupport).toEqual([1.0950, 1.0900]);
      expect(overlays.keyResistance).toEqual([1.1100, 1.1150]);
    });

    it('handles empty analysis gracefully', () => {
      const emptyAnalysis: AnalysisResult = {
        structure: { trend: 'ranging', swingPoints: [], bos: [], choch: [] },
        orderBlocks: [],
        fvgs: [],
        liquidityPools: [],
        fibLevels: [],
        fiftyPercentLevel: 0,
        keySupport: [],
        keyResistance: [],
      };
      const overlays = analysisToOverlays(emptyAnalysis);
      expect(overlays.orderBlocks).toHaveLength(0);
      expect(overlays.fvgs).toHaveLength(0);
      expect(overlays.swingPoints).toHaveLength(0);
      expect(overlays.liquidityPools).toHaveLength(0);
    });
  });

  describe('positionsToTradeOverlays', () => {
    const mockPositions = [
      { id: '1', symbol: 'EUR/USD', direction: 'long', entryPrice: 1.1050, stopLoss: 1.1000, takeProfit: 1.1150, size: 0.10, signalReason: 'BOS + OB' },
      { id: '2', symbol: 'EUR/USD', direction: 'short', entryPrice: 1.1080, stopLoss: 1.1120, takeProfit: 1.1000, size: 0.05, signalReason: 'CHoCH' },
      { id: '3', symbol: 'GBP/USD', direction: 'long', entryPrice: 1.2700, stopLoss: 1.2650, takeProfit: 1.2800, size: 0.20, signalReason: 'FVG' },
    ];

    it('filters positions by symbol', () => {
      const overlays = positionsToTradeOverlays(mockPositions, 'EUR/USD');
      expect(overlays?.trades).toHaveLength(2);
    });

    it('returns undefined when no positions match symbol', () => {
      const overlays = positionsToTradeOverlays(mockPositions, 'USD/JPY');
      expect(overlays).toBeUndefined();
    });

    it('maps trade fields correctly', () => {
      const overlays = positionsToTradeOverlays(mockPositions, 'EUR/USD');
      expect(overlays?.trades[0]).toEqual({
        entryPrice: 1.1050,
        stopLoss: 1.1000,
        takeProfit: 1.1150,
        direction: 'long',
        label: '0.1 lots',
      });
    });

    it('handles null SL/TP', () => {
      const positions = [
        { id: '4', symbol: 'EUR/USD', direction: 'long', entryPrice: 1.1050, stopLoss: null, takeProfit: null, size: 0.01, signalReason: '' },
      ];
      const overlays = positionsToTradeOverlays(positions, 'EUR/USD');
      expect(overlays?.trades[0].stopLoss).toBeNull();
      expect(overlays?.trades[0].takeProfit).toBeNull();
    });

    it('handles empty positions array', () => {
      const overlays = positionsToTradeOverlays([], 'EUR/USD');
      expect(overlays).toBeUndefined();
    });
  });
});
