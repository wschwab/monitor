import { describe, it, expect } from 'vitest';
import {
  isTaskActive,
  isTaskTerminal,
  validateBudget,
  validateDeadline,
  validateSpendPath,
  validateSpend,
  aggregateSpends,
  makeIdempotencyKey,
  requiresOnChainVerification,
  SOURCE_OF_TRUTH,
  ACTIVE_STATUSES,
  TERMINAL_STATUSES,
  VALID_SPEND_PATHS,
} from './spend-policy';

describe('spend-policy', () => {
  describe('isTaskActive', () => {
    it('should return true for active statuses', () => {
      expect(isTaskActive('RUNNING')).toBe(true);
      expect(isTaskActive('COMPILING')).toBe(true);
      expect(isTaskActive('ENHANCING')).toBe(true);
      expect(isTaskActive('FUNDING')).toBe(true);
    });

    it('should return false for terminal statuses', () => {
      expect(isTaskActive('COMPLETE')).toBe(false);
      expect(isTaskActive('FAILED')).toBe(false);
      expect(isTaskActive('STOPPED')).toBe(false);
    });

    it('should return false for CREATED', () => {
      expect(isTaskActive('CREATED')).toBe(false);
    });
  });

  describe('isTaskTerminal', () => {
    it('should return true for terminal statuses', () => {
      expect(isTaskTerminal('COMPLETE')).toBe(true);
      expect(isTaskTerminal('FAILED')).toBe(true);
      expect(isTaskTerminal('STOPPED')).toBe(true);
    });

    it('should return false for active statuses', () => {
      expect(isTaskTerminal('RUNNING')).toBe(false);
      expect(isTaskTerminal('COMPILING')).toBe(false);
    });
  });

  describe('validateBudget', () => {
    it('should accept spend within budget', () => {
      const result = validateBudget(BigInt(0), BigInt(1000), BigInt(500));
      expect(result.valid).toBe(true);
    });

    it('should reject spend exceeding budget', () => {
      const result = validateBudget(BigInt(800), BigInt(1000), BigInt(300));
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('BUDGET_EXCEEDED');
    });

    it('should reject zero or negative amounts', () => {
      expect(validateBudget(BigInt(0), BigInt(1000), BigInt(0)).valid).toBe(false);
      expect(validateBudget(BigInt(0), BigInt(1000), BigInt(-1)).valid).toBe(false);
    });
  });

  describe('validateDeadline', () => {
    it('should accept spend before deadline', () => {
      const future = Date.now() + 3600000;
      const result = validateDeadline(future);
      expect(result.valid).toBe(true);
    });

    it('should reject spend after deadline', () => {
      const past = Date.now() - 1000;
      const result = validateDeadline(past);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('DEADLINE_PASSED');
    });
  });

  describe('validateSpendPath', () => {
    it('should accept valid paths', () => {
      expect(validateSpendPath('TREASURY').valid).toBe(true);
      expect(validateSpendPath('DIRECT_MPP').valid).toBe(true);
      expect(validateSpendPath('LLM').valid).toBe(true);
    });

    it('should reject invalid paths', () => {
      const result = validateSpendPath('INVALID');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('INVALID_PATH');
    });
  });

  describe('validateSpend', () => {
    const baseState = {
      status: 'RUNNING' as const,
      budgetWei: BigInt(1000),
      spentWei: BigInt(0),
      deadlineMs: Date.now() + 3600000,
    };

    it('should pass all checks for valid spend', () => {
      const result = validateSpend(baseState, BigInt(100), 'key-1', new Set());
      expect(result.valid).toBe(true);
    });

    it('should fail for inactive task', () => {
      const result = validateSpend(
        { ...baseState, status: 'STOPPED' },
        BigInt(100),
        'key-1',
        new Set()
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('TASK_NOT_ACTIVE');
    });

    it('should fail for passed deadline', () => {
      const result = validateSpend(
        { ...baseState, deadlineMs: Date.now() - 1000 },
        BigInt(100),
        'key-1',
        new Set()
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('DEADLINE_PASSED');
    });

    it('should fail for exceeded budget', () => {
      const result = validateSpend(
        { ...baseState, spentWei: BigInt(900) },
        BigInt(200),
        'key-1',
        new Set()
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('BUDGET_EXCEEDED');
    });

    it('should fail for duplicate idempotency key', () => {
      const seen = new Set(['key-1']);
      const result = validateSpend(baseState, BigInt(100), 'key-1', seen);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('DUPLICATE_IDEMPOTENCY_KEY');
    });
  });

  describe('aggregateSpends', () => {
    it('should aggregate by path and service', () => {
      const entries = [
        { amountWei: BigInt(100), path: 'DIRECT_MPP' as const, serviceId: 'exa' },
        { amountWei: BigInt(200), path: 'DIRECT_MPP' as const, serviceId: 'exa' },
        { amountWei: BigInt(300), path: 'TREASURY' as const, serviceId: 'cern' },
      ];

      const result = aggregateSpends(entries);
      expect(result.totalWei).toBe(BigInt(600));
      expect(result.byPath.DIRECT_MPP).toBe(BigInt(300));
      expect(result.byPath.TREASURY).toBe(BigInt(300));
      expect(result.byService['exa']).toBe(BigInt(300));
    });

    it('should handle empty entries', () => {
      const result = aggregateSpends([]);
      expect(result.totalWei).toBe(BigInt(0));
    });
  });

  describe('makeIdempotencyKey', () => {
    it('should combine task and client key', () => {
      const key = makeIdempotencyKey('task-1', 'client-key');
      expect(key).toBe('task-1:client-key');
    });
  });

  describe('SOURCE_OF_TRUTH', () => {
    it('should require on-chain for TREASURY', () => {
      expect(requiresOnChainVerification('TREASURY')).toBe(true);
    });

    it('should not require on-chain for DIRECT_MPP', () => {
      expect(requiresOnChainVerification('DIRECT_MPP')).toBe(false);
    });

    it('should not require on-chain for LLM', () => {
      expect(requiresOnChainVerification('LLM')).toBe(false);
    });
  });

  describe('constants', () => {
    it('should have expected active statuses', () => {
      expect(ACTIVE_STATUSES).toContain('RUNNING');
      expect(ACTIVE_STATUSES).toContain('COMPILING');
      expect(ACTIVE_STATUSES).toContain('ENHANCING');
    });

    it('should have expected terminal statuses', () => {
      expect(TERMINAL_STATUSES).toContain('COMPLETE');
      expect(TERMINAL_STATUSES).toContain('FAILED');
      expect(TERMINAL_STATUSES).toContain('STOPPED');
    });

    it('should have all spend paths', () => {
      expect(VALID_SPEND_PATHS).toHaveLength(3);
      expect(VALID_SPEND_PATHS).toContain('TREASURY');
      expect(VALID_SPEND_PATHS).toContain('DIRECT_MPP');
      expect(VALID_SPEND_PATHS).toContain('LLM');
    });
  });
});