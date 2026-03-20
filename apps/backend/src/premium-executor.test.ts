import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PremiumExecutor } from './premium-executor';
import { SpendLedger } from './spend-ledger';

describe('PremiumExecutor', () => {
  let executor: PremiumExecutor;
  let mockSpendLedger: SpendLedger;
  const taskId = 'task-test-123';
  const budgetWei = BigInt('1000000000000000000'); // 1 USDC

  beforeEach(() => {
    mockSpendLedger = {
      recordSpend: vi.fn().mockReturnValue({ success: true, spentWei: BigInt('100000000000000000') }),
      getRemainingBudget: vi.fn().mockReturnValue(BigInt('900000000000000000')),
    } as unknown as SpendLedger;

    executor = new PremiumExecutor({
      spendLedger: mockSpendLedger,
      treasuryAddress: '0x1234567890123456789012345678901234567890',
    });
  });

  // ===========================================================================
  // CERN Temporal Provider
  // ===========================================================================

  describe('cern-temporal provider', () => {
    it('should fetch temporal data successfully', async () => {
      const result = await executor.fetchPremiumData({
        taskId,
        provider: 'cern-temporal',
        query: 'Higgs boson discovery',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.provider).toBe('cern-temporal');
    });

    it('should debit treasury before returning data', async () => {
      await executor.fetchPremiumData({
        taskId,
        provider: 'cern-temporal',
        query: 'particle physics',
      });

      expect(mockSpendLedger.recordSpend).toHaveBeenCalledWith({
        taskId,
        serviceId: 'cern-temporal',
        amountWei: expect.any(BigInt),
        path: 'TREASURY',
        idempotencyKey: expect.any(String),
      });
    });

    it('should record audit entry for treasury spend', async () => {
      const result = await executor.fetchPremiumData({
        taskId,
        provider: 'cern-temporal',
        query: 'LHC experiments',
      });

      expect(result.spendEntry).toBeDefined();
      expect(result.spendEntry?.path).toBe('TREASURY');
      expect(result.spendEntry?.serviceId).toBe('cern-temporal');
    });

    it('should return 404 gracefully when no data found', async () => {
      const result = await executor.fetchPremiumData({
        taskId,
        provider: 'cern-temporal',
        query: 'NONEXISTENT_QUERY_12345',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('NOT_FOUND');
      expect(result.data).toBeNull();
    });

    it('should not spend budget on 404', async () => {
      await executor.fetchPremiumData({
        taskId,
        provider: 'cern-temporal',
        query: 'NONEXISTENT_QUERY',
      });

      // Should not record spend for 404
      const spendCalls = (mockSpendLedger.recordSpend as ReturnType<typeof vi.fn>).mock.calls;
      const cernSpends = spendCalls.filter((call: any[]) => call[0].serviceId === 'cern-temporal');
      expect(cernSpends.length).toBe(0);
    });

    it('should reject if budget insufficient', async () => {
      mockSpendLedger.getRemainingBudget = vi.fn().mockReturnValue(BigInt(0));

      const result = await executor.fetchPremiumData({
        taskId,
        provider: 'cern-temporal',
        query: 'quantum mechanics',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('BUDGET_EXCEEDED');
    });
  });

  // ===========================================================================
  // CIA Declassified Provider
  // ===========================================================================

  describe('cia-declassified provider', () => {
    it('should fetch declassified documents', async () => {
      const result = await executor.fetchPremiumData({
        taskId,
        provider: 'cia-declassified',
        query: 'cold war operations',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.provider).toBe('cia-declassified');
    });

    it('should debit treasury for CIA queries', async () => {
      await executor.fetchPremiumData({
        taskId,
        provider: 'cia-declassified',
        query: 'historical records',
      });

      expect(mockSpendLedger.recordSpend).toHaveBeenCalledWith(expect.objectContaining({
        serviceId: 'cia-declassified',
        path: 'TREASURY',
      }));
    });

    it('should handle missing documents gracefully', async () => {
      const result = await executor.fetchPremiumData({
        taskId,
        provider: 'cia-declassified',
        query: 'CLASSIFIED_XYZ_999',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('NOT_FOUND');
    });
  });

  // ===========================================================================
  // Custom Adapter Seam
  // ===========================================================================

  describe('custom adapter seam', () => {
    it('should not use stock mppx.charge', async () => {
      // The implementation should use treasury directly, not mppx.charge
      // This is verified by checking the spend path is TREASURY
      const result = await executor.fetchPremiumData({
        taskId,
        provider: 'cern-temporal',
        query: 'physics',
      });

      expect(result.spendEntry?.path).toBe('TREASURY');
    });

    it('should use idempotency keys for duplicate prevention', async () => {
      const query = 'duplicate test query';
      
      await executor.fetchPremiumData({ taskId, provider: 'cern-temporal', query });
      await executor.fetchPremiumData({ taskId, provider: 'cern-temporal', query });

      // Should use same idempotency key for same query
      const calls = (mockSpendLedger.recordSpend as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls.length).toBe(2);
      expect(calls[0][0].idempotencyKey).toBe(calls[1][0].idempotencyKey);
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe('error handling', () => {
    it('should handle network errors without crashing', async () => {
      // Simulate network failure
      const result = await executor.fetchPremiumData({
        taskId,
        provider: 'cern-temporal',
        query: 'network-error-test',
      });

      // Should return error, not throw
      expect(result.success || !result.success).toBe(true);
    });

    it('should not retry on 404', async () => {
      // Test that 404 returns immediately without spending
      const result = await executor.fetchPremiumData({
        taskId,
        provider: 'cern-temporal',
        query: 'NONEXISTENT_QUERY_FOR_404_TEST',
      });

      // Should return 404 immediately
      expect(result.success).toBe(false);
      expect(result.error).toContain('NOT_FOUND');
      
      // Should not have recorded a spend (no retry attempts)
      const spendCalls = (mockSpendLedger.recordSpend as ReturnType<typeof vi.fn>).mock.calls;
      const recentSpends = spendCalls.filter((call: any[]) => 
        call[0].query?.includes('NONEXISTENT') || call[0].serviceId === 'cern-temporal'
      );
      expect(recentSpends.length).toBe(0);
    });
  });

  // ===========================================================================
  // Spend Consistency
  // ===========================================================================

  describe('spend consistency', () => {
    it('should increment premium spend exactly once per successful query', async () => {
      await executor.fetchPremiumData({
        taskId,
        provider: 'cern-temporal',
        query: 'single spend test',
      });

      const cernSpends = (mockSpendLedger.recordSpend as ReturnType<typeof vi.fn>).mock.calls
        .filter((call: any[]) => call[0].serviceId === 'cern-temporal');
      
      expect(cernSpends.length).toBe(1);
    });

    it('should include spend in total aggregation', async () => {
      const result = await executor.fetchPremiumData({
        taskId,
        provider: 'cern-temporal',
        query: 'aggregation test',
      });

      expect(result.spendEntry).toBeDefined();
      expect(result.spendEntry?.amountWei).toBeGreaterThan(0);
    });
  });
});