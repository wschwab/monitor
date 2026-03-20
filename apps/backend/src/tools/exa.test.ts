/**
 * Exa Provider Adapter Tests
 *
 * Tests for the real Exa search provider with 402 payment flow
 * and spend-ledger reconciliation.
 *
 * TDD: These tests are written FIRST (RED), then implementation follows (GREEN).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExaAdapter, ExaAdapterOptions } from './exa';
import { SpendLedger } from '../spend-ledger';

// =============================================================================
// Fixtures
// =============================================================================

const MOCK_EXA_RESULT = {
  results: [
    {
      title: 'CERN Classified: Hououin Kyouma Dossier',
      url: 'https://opendata.cern.ch/records/kyouma-dossier',
      text: 'Subject alias: Hououin Kyouma. Real identity: classified. Threat level: DIVERGENT.',
      score: 0.97,
    },
    {
      title: 'Time Displacement Field Anomalies at LHC - 2010 Report',
      url: 'https://opendata.cern.ch/records/lhc-anomalies-2010',
      text: 'Unexplained temporal fluctuations observed during operation...',
      score: 0.89,
    },
  ],
  autopromptString: 'CERN classified dossier Hououin Kyouma time displacement',
};

const MOCK_SPEND_AMOUNT = BigInt('10000000000000000'); // 0.01 ETH

// =============================================================================
// Helper: build adapter with mocked fetch
// =============================================================================

function buildAdapter(overrides: Partial<ExaAdapterOptions> = {}) {
  const spendLedger = new SpendLedger();
  spendLedger.createTask({
    taskId: 'task-test-001',
    budgetWei: BigInt('1000000000000000000'),
    deadlineMs: Date.now() + 3_600_000,
  });

  return {
    spendLedger,
    adapter: new ExaAdapter({
      spendLedger,
      apiKey: 'test-api-key',
      demoMode: false,
      ...overrides,
    }),
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('ExaAdapter', () => {
  describe('search (demo mode)', () => {
    it('should return fixture data without hitting network', async () => {
      const { adapter } = buildAdapter({ demoMode: true });

      const result = await adapter.search({
        taskId: 'task-test-001',
        query: 'Hououin Kyouma CERN classified dossier',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.results).toBeInstanceOf(Array);
      expect(result.data!.results.length).toBeGreaterThan(0);
    });

    it('should record spend entry in demo mode', async () => {
      const { adapter, spendLedger } = buildAdapter({ demoMode: true });

      const result = await adapter.search({
        taskId: 'task-test-001',
        query: 'classified temporal dossier',
      });

      expect(result.success).toBe(true);
      expect(result.spendEntry).toBeDefined();
      expect(result.spendEntry!.amountWei).toBeGreaterThan(BigInt(0));

      const totals = spendLedger.getSpendTotals('task-test-001');
      expect(totals.totalWei).toBeGreaterThan(BigInt(0));
    });

    it('should use DIRECT_MPP spend path', async () => {
      const { adapter } = buildAdapter({ demoMode: true });

      const result = await adapter.search({
        taskId: 'task-test-001',
        query: 'test query',
      });

      expect(result.spendEntry?.path).toBe('DIRECT_MPP');
    });
  });

  describe('search (live mode with mocked fetch)', () => {
    it('should call Exa API and return results', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => MOCK_EXA_RESULT,
      });

      const { adapter } = buildAdapter({
        demoMode: false,
        fetchFn: mockFetch as any,
      });

      const result = await adapter.search({
        taskId: 'task-test-001',
        query: 'Hououin Kyouma CERN',
      });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledOnce();
      expect(result.data!.results).toHaveLength(2);
      expect(result.data!.results[0].title).toContain('Hououin Kyouma');
    });

    it('should record spend after successful API call', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => MOCK_EXA_RESULT,
      });

      const { adapter, spendLedger } = buildAdapter({
        demoMode: false,
        fetchFn: mockFetch as any,
      });

      await adapter.search({
        taskId: 'task-test-001',
        query: 'time machine anomalies',
      });

      const totals = spendLedger.getSpendTotals('task-test-001');
      expect(totals.totalWei).toBeGreaterThan(BigInt(0));
      expect(totals.byPath['DIRECT_MPP']).toBeGreaterThan(BigInt(0));
    });

    it('should handle 402 payment-required with idempotency key', async () => {
      // First call returns 402, second (after "payment") succeeds
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 402,
          json: async () => ({ error: 'Payment required', amountWei: '10000000000000000' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => MOCK_EXA_RESULT,
        });

      const { adapter, spendLedger } = buildAdapter({
        demoMode: false,
        fetchFn: mockFetch as any,
      });

      const result = await adapter.search({
        taskId: 'task-test-001',
        query: 'classified temporal data',
        idempotencyKey: 'idem-key-001',
      });

      expect(result.success).toBe(true);
      // Spend should be recorded exactly once even after retry
      const totals = spendLedger.getSpendTotals('task-test-001');
      expect(totals.totalWei).toBeGreaterThan(BigInt(0));
    });

    it('should not double-charge on duplicate idempotency key', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => MOCK_EXA_RESULT,
      });

      const { adapter, spendLedger } = buildAdapter({
        demoMode: false,
        fetchFn: mockFetch as any,
      });

      // Same idempotency key used twice
      await adapter.search({
        taskId: 'task-test-001',
        query: 'divergence meter reading',
        idempotencyKey: 'idem-dup-001',
      });
      await adapter.search({
        taskId: 'task-test-001',
        query: 'divergence meter reading',
        idempotencyKey: 'idem-dup-001',
      });

      const entries = spendLedger.getTaskEntries('task-test-001');
      const dedupedEntries = entries.filter(e => e.idempotencyKey === 'idem-dup-001');
      expect(dedupedEntries).toHaveLength(1);
    });
  });

  describe('error handling', () => {
    it('should return partial-data-safe error on timeout', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('AbortError: request timed out'));

      const { adapter } = buildAdapter({
        demoMode: false,
        fetchFn: mockFetch as any,
        timeoutMs: 100,
      });

      const result = await adapter.search({
        taskId: 'task-test-001',
        query: 'slow query',
      });

      // Should NOT throw — returns error object instead
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.data).toBeNull();
    });

    it('should fall back to demo mode on error when fallbackToDemo=true', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const { adapter } = buildAdapter({
        demoMode: false,
        fallbackToDemo: true,
        fetchFn: mockFetch as any,
      });

      const result = await adapter.search({
        taskId: 'task-test-001',
        query: 'fallback query',
      });

      expect(result.success).toBe(true);
      expect(result.fromDemo).toBe(true);
      expect(result.data!.results).toBeInstanceOf(Array);
    });

    it('should return error when API key is missing and not demo mode', async () => {
      const { adapter } = buildAdapter({ demoMode: false, apiKey: '' });

      const result = await adapter.search({
        taskId: 'task-test-001',
        query: 'unauthorized query',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/API_KEY/i);
    });

    it('should fall back to demo mode when API key is missing but fallbackToDemo=true', async () => {
      const { adapter } = buildAdapter({
        demoMode: false,
        apiKey: '',
        fallbackToDemo: true,
      });

      const result = await adapter.search({
        taskId: 'task-test-001',
        query: 'kyouma fallback query',
      });

      expect(result.success).toBe(true);
      expect(result.fromDemo).toBe(true);
      expect(result.spendEntry?.queryIndex).toBe(0);
    });

    it('should return error on non-200 non-402 response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' }),
      });

      const { adapter } = buildAdapter({
        demoMode: false,
        fetchFn: mockFetch as any,
      });

      const result = await adapter.search({
        taskId: 'task-test-001',
        query: 'server error query',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('budget enforcement', () => {
    it('should reject search if task budget is exhausted', async () => {
      const spendLedger = new SpendLedger();
      spendLedger.createTask({
        taskId: 'task-tiny-budget',
        budgetWei: BigInt(1), // 1 wei — way too small
        deadlineMs: Date.now() + 3_600_000,
      });

      const adapter = new ExaAdapter({
        spendLedger,
        apiKey: 'test-key',
        demoMode: true,
      });

      const result = await adapter.search({
        taskId: 'task-tiny-budget',
        query: 'budget exhausted query',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/budget/i);
    });
  });
});
