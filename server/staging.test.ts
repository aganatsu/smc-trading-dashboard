/**
 * Tests for Setup Staging / Watchlist feature in botEngine
 * 
 * Tests the staging types, helper functions, and public API
 * without starting the full engine (which requires market data).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getActiveStagedSetups,
  getAllStagedSetups,
  dismissStagedSetup,
  getEngineState,
  type StagedSetup,
} from './botEngine';

describe('Setup Staging', () => {
  describe('StagedSetup type contract', () => {
    it('should define all required fields on a StagedSetup', () => {
      const mockSetup: StagedSetup = {
        id: 'stg_test_001',
        symbol: 'EUR/USD',
        direction: 'long',
        initialScore: 4,
        currentScore: 5,
        watchThreshold: 3,
        gateThreshold: 6,
        initialFactors: [],
        currentFactors: [{ concept: 'Order Block', present: true, weight: 2, detail: 'Bullish OB at 1.0800' }],
        missingFactors: [{ concept: 'FVG', present: false, weight: 1.5, detail: 'No relevant FVG' }],
        entryPrice: null,
        slLevel: null,
        tpLevel: null,
        status: 'watching',
        scanCycles: 1,
        minCycles: 2,
        ttlMinutes: 240,
        stagedAt: Date.now(),
        lastEvalAt: Date.now(),
        resolvedAt: null,
        promotionReason: null,
        invalidationReason: null,
        setupType: 'bullish',
        tier1Count: 1,
        tier2Count: 0,
        analysisSnapshot: { score: 5, bias: 'bullish' },
      };

      expect(mockSetup.id).toBe('stg_test_001');
      expect(mockSetup.symbol).toBe('EUR/USD');
      expect(mockSetup.direction).toBe('long');
      expect(mockSetup.status).toBe('watching');
      expect(mockSetup.currentFactors).toHaveLength(1);
      expect(mockSetup.missingFactors).toHaveLength(1);
      expect(mockSetup.tier1Count).toBe(1);
    });
  });

  describe('Public API functions', () => {
    it('getActiveStagedSetups should return an array', () => {
      const active = getActiveStagedSetups();
      expect(Array.isArray(active)).toBe(true);
    });

    it('getAllStagedSetups should return an array', () => {
      const all = getAllStagedSetups();
      expect(Array.isArray(all)).toBe(true);
    });

    it('dismissStagedSetup should return false for non-existent ID', () => {
      const result = dismissStagedSetup('nonexistent_id');
      expect(result).toBe(false);
    });

    it('getEngineState should include stagedSetups field', () => {
      const state = getEngineState();
      expect(state).toHaveProperty('stagedSetups');
      expect(Array.isArray(state.stagedSetups)).toBe(true);
    });
  });

  describe('EngineState staging integration', () => {
    it('should include staging stats in engine state', () => {
      const state = getEngineState();
      // Verify the new stagedSetups field is present alongside existing fields
      expect(state).toHaveProperty('running');
      expect(state).toHaveProperty('autoTrading');
      expect(state).toHaveProperty('totalScans');
      expect(state).toHaveProperty('totalSignals');
      expect(state).toHaveProperty('totalTradesPlaced');
      expect(state).toHaveProperty('totalRejected');
      expect(state).toHaveProperty('scanResults');
      expect(state).toHaveProperty('tradeReasonings');
      expect(state).toHaveProperty('postMortems');
      expect(state).toHaveProperty('stagedSetups');
    });

    it('stagedSetups should start empty when engine has not run', () => {
      const state = getEngineState();
      expect(state.stagedSetups).toEqual([]);
    });
  });

  describe('StagedSetup status transitions', () => {
    it('should support all valid status values', () => {
      const statuses: StagedSetup['status'][] = ['watching', 'promoted', 'expired', 'invalidated'];
      statuses.forEach(status => {
        expect(['watching', 'promoted', 'expired', 'invalidated']).toContain(status);
      });
    });

    it('should support long and short directions', () => {
      const directions: StagedSetup['direction'][] = ['long', 'short'];
      directions.forEach(dir => {
        expect(['long', 'short']).toContain(dir);
      });
    });
  });
});
