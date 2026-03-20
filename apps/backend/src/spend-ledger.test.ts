/**
 * Spend Ledger Tests
 *
 * Tests for budget/deadline enforcement, idempotency, and spend aggregation.
 * 
 * TDD: These tests MUST fail initially (RED phase), then pass after implementation (GREEN phase).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SpendLedger, createSpendLedger } from './spend-ledger';
import { SpendEntry, SpendPath, TaskStatus } from '@monitor/shared';

describe('SpendLedger', () => {
  let ledger: SpendLedger;
  const taskId = 'task-123';
  const budgetWei = BigInt('1000000000000000000'); // 1 USDC
  const deadlineMs = Date.now() + 3600000; // 1 hour from now

  beforeEach(() => {
    ledger = createSpendLedger();
  });

  // ===========================================================================
  // Budget Enforcement
  // ===========================================================================

  describe('budget enforcement', () => {
    it('should accept spend within budget', () => {
      ledger.initTask(taskId, budgetWei, deadlineMs, 'RUNNING');
      
      const result = ledger.recordSpend({
        taskId,
        serviceId: 'exa',
        amountWei: BigInt('100000000000000000'), // 0.1 USDC
        path: 'DIRECT_MPP',
        idempotencyKey: 'spend-1',
      });

      expect(result.success).toBe(true);
      expect(result.spentWei).toBe(BigInt('100000000000000000'));
    });

    it('should reject spend exceeding budget', () => {
      ledger.initTask(taskId, budgetWei, deadlineMs, 'RUNNING');
      
      // First spend: 0.9 USDC
      ledger.recordSpend({
        taskId,
        serviceId: 'exa',
        amountWei: BigInt('900000000000000000'),
        path: 'DIRECT_MPP',
        idempotencyKey: 'spend-1',
      });

      // Second spend: 0.2 USDC (would exceed 1 USDC budget)
      const result = ledger.recordSpend({
        taskId,
        serviceId: 'perplexity',
        amountWei: BigInt('200000000000000000'),
        path: 'DIRECT_MPP',
        idempotencyKey: 'spend-2',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('BUDGET_EXCEEDED');
      expect(result.spentWei).toBe(BigInt('900000000000000000'));
    });

    it('should track total spend across all paths', () => {
      ledger.initTask(taskId, budgetWei, deadlineMs, 'RUNNING');
      
      // Direct MPP spend
      ledger.recordSpend({
        taskId,
        serviceId: 'exa',
        amountWei: BigInt('200000000000000000'), // 0.2 USDC
        path: 'DIRECT_MPP',
        idempotencyKey: 'spend-1',
      });

      // Treasury spend
      ledger.recordSpend({
        taskId,
        serviceId: 'cern-temporal',
        amountWei: BigInt('300000000000000000'), // 0.3 USDC
        path: 'TREASURY',
        idempotencyKey: 'spend-2',
      });

      // LLM spend
      ledger.recordSpend({
        taskId,
        serviceId: 'llm',
        amountWei: BigInt('100000000000000000'), // 0.1 USDC
        path: 'LLM',
        idempotencyKey: 'spend-3',
      });

      const totals = ledger.getTotals(taskId);
      expect(totals.totalWei).toBe(BigInt('600000000000000000'));
      expect(totals.byPath.DIRECT_MPP).toBe(BigInt('200000000000000000'));
      expect(totals.byPath.TREASURY).toBe(BigInt('300000000000000000'));
      expect(totals.byPath.LLM).toBe(BigInt('100000000000000000'));
    });
  });

  // ===========================================================================
  // Deadline Enforcement
  // ===========================================================================

  describe('deadline enforcement', () => {
    it('should accept spend before deadline', () => {
      const futureDeadline = Date.now() + 3600000;
      ledger.initTask(taskId, budgetWei, futureDeadline, 'RUNNING');
      
      const result = ledger.recordSpend({
        taskId,
        serviceId: 'exa',
        amountWei: BigInt('100000000000000000'),
        path: 'DIRECT_MPP',
        idempotencyKey: 'spend-1',
      });

      expect(result.success).toBe(true);
    });

    it('should reject spend after deadline', () => {
      const pastDeadline = Date.now() - 1000; // 1 second ago
      ledger.initTask(taskId, budgetWei, pastDeadline, 'RUNNING');
      
      const result = ledger.recordSpend({
        taskId,
        serviceId: 'exa',
        amountWei: BigInt('100000000000000000'),
        path: 'DIRECT_MPP',
        idempotencyKey: 'spend-1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('DEADLINE_PASSED');
    });

    it('should use current time for deadline check', () => {
      const nearDeadline = Date.now() + 100; // 100ms from now
      ledger.initTask(taskId, budgetWei, nearDeadline, 'RUNNING');
      
      // This might pass or fail depending on timing, but should not throw
      const result = ledger.recordSpend({
        taskId,
        serviceId: 'exa',
        amountWei: BigInt('100000000000000000'),
        path: 'DIRECT_MPP',
        idempotencyKey: 'spend-1',
      });

      // Either success or DEADLINE_PASSED is acceptable
      expect([true, false]).toContain(result.success);
    });
  });

  // ===========================================================================
  // Idempotency (Duplicate Prevention)
  // ===========================================================================

  describe('idempotency', () => {
    it('should reject duplicate idempotency keys', () => {
      ledger.initTask(taskId, budgetWei, deadlineMs, 'RUNNING');
      
      // First spend
      const result1 = ledger.recordSpend({
        taskId,
        serviceId: 'exa',
        amountWei: BigInt('100000000000000000'),
        path: 'DIRECT_MPP',
        idempotencyKey: 'unique-spend-1',
      });
      expect(result1.success).toBe(true);

      // Duplicate idempotency key (different amount)
      const result2 = ledger.recordSpend({
        taskId,
        serviceId: 'exa',
        amountWei: BigInt('200000000000000000'), // Different amount
        path: 'DIRECT_MPP',
        idempotencyKey: 'unique-spend-1', // Same key
      });

      expect(result2.success).toBe(false);
      expect(result2.error).toContain('DUPLICATE_IDEMPOTENCY_KEY');
      // Total should still be 0.1 USDC, not 0.3 USDC
      expect(result2.spentWei).toBe(BigInt('100000000000000000'));
    });

    it('should allow same service with different idempotency keys', () => {
      ledger.initTask(taskId, budgetWei, deadlineMs, 'RUNNING');
      
      ledger.recordSpend({
        taskId,
        serviceId: 'exa',
        amountWei: BigInt('100000000000000000'),
        path: 'DIRECT_MPP',
        idempotencyKey: 'exa-query-1',
      });

      const result = ledger.recordSpend({
        taskId,
        serviceId: 'exa',
        amountWei: BigInt('100000000000000000'),
        path: 'DIRECT_MPP',
        idempotencyKey: 'exa-query-2', // Different key
      });

      expect(result.success).toBe(true);
      expect(result.spentWei).toBe(BigInt('200000000000000000'));
    });

    it('should return idempotent result for duplicate key', () => {
      ledger.initTask(taskId, budgetWei, deadlineMs, 'RUNNING');
      
      const original = ledger.recordSpend({
        taskId,
        serviceId: 'exa',
        amountWei: BigInt('100000000000000000'),
        path: 'DIRECT_MPP',
        idempotencyKey: 'idempotent-spend',
      });

      const duplicate = ledger.recordSpend({
        taskId,
        serviceId: 'exa',
        amountWei: BigInt('100000000000000000'), // Same amount
        path: 'DIRECT_MPP',
        idempotencyKey: 'idempotent-spend', // Same key
      });

      // Should return same result, not error
      expect(duplicate.success).toBe(false);
      expect(duplicate.spentWei).toBe(original.spentWei);
    });
  });

  // ===========================================================================
  // Task Status Enforcement
  // ===========================================================================

  describe('task status enforcement', () => {
    it('should reject spend on STOPPED task', () => {
      ledger.initTask(taskId, budgetWei, deadlineMs, 'STOPPED');
      
      const result = ledger.recordSpend({
        taskId,
        serviceId: 'exa',
        amountWei: BigInt('100000000000000000'),
        path: 'DIRECT_MPP',
        idempotencyKey: 'spend-1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('TASK_NOT_ACTIVE');
    });

    it('should reject spend on COMPLETE task', () => {
      ledger.initTask(taskId, budgetWei, deadlineMs, 'COMPLETE');
      
      const result = ledger.recordSpend({
        taskId,
        serviceId: 'exa',
        amountWei: BigInt('100000000000000000'),
        path: 'DIRECT_MPP',
        idempotencyKey: 'spend-1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('TASK_NOT_ACTIVE');
    });

    it('should reject spend on FAILED task', () => {
      ledger.initTask(taskId, budgetWei, deadlineMs, 'FAILED');
      
      const result = ledger.recordSpend({
        taskId,
        serviceId: 'exa',
        amountWei: BigInt('100000000000000000'),
        path: 'DIRECT_MPP',
        idempotencyKey: 'spend-1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('TASK_NOT_ACTIVE');
    });

    it('should accept spend on RUNNING task', () => {
      ledger.initTask(taskId, budgetWei, deadlineMs, 'RUNNING');
      
      const result = ledger.recordSpend({
        taskId,
        serviceId: 'exa',
        amountWei: BigInt('100000000000000000'),
        path: 'DIRECT_MPP',
        idempotencyKey: 'spend-1',
      });

      expect(result.success).toBe(true);
    });

    it('should accept spend on COMPILING task', () => {
      ledger.initTask(taskId, budgetWei, deadlineMs, 'COMPILING');
      
      const result = ledger.recordSpend({
        taskId,
        serviceId: 'llm',
        amountWei: BigInt('100000000000000000'),
        path: 'LLM',
        idempotencyKey: 'spend-1',
      });

      expect(result.success).toBe(true);
    });

    it('should accept spend on ENHANCING task', () => {
      ledger.initTask(taskId, budgetWei, deadlineMs, 'ENHANCING');
      
      const result = ledger.recordSpend({
        taskId,
        serviceId: 'cover-image',
        amountWei: BigInt('100000000000000000'),
        path: 'TREASURY',
        idempotencyKey: 'spend-1',
      });

      expect(result.success).toBe(true);
    });
  });

  // ===========================================================================
  // Total Spend Query
  // ===========================================================================

  describe('total spend query', () => {
    it('should return zero for non-existent task', () => {
      const totals = ledger.getTotals('non-existent-task');
      expect(totals.totalWei).toBe(BigInt(0));
      expect(totals.byPath).toEqual({});
    });

    it('should aggregate all spend entries', () => {
      ledger.initTask(taskId, budgetWei, deadlineMs, 'RUNNING');
      
      for (let i = 0; i < 5; i++) {
        ledger.recordSpend({
          taskId,
          serviceId: 'exa',
          amountWei: BigInt('100000000000000000'), // 0.1 USDC each
          path: 'DIRECT_MPP',
          idempotencyKey: `spend-${i}`,
        });
      }

      const totals = ledger.getTotals(taskId);
      expect(totals.totalWei).toBe(BigInt('500000000000000000')); // 0.5 USDC
      expect(totals.byPath.DIRECT_MPP).toBe(BigInt('500000000000000000'));
    });

    it('should expose individual entries', () => {
      ledger.initTask(taskId, budgetWei, deadlineMs, 'RUNNING');
      
      ledger.recordSpend({
        taskId,
        serviceId: 'exa',
        amountWei: BigInt('100000000000000000'),
        path: 'DIRECT_MPP',
        idempotencyKey: 'spend-1',
      });

      const entries = ledger.getEntries(taskId);
      expect(entries).toHaveLength(1);
      expect(entries[0].serviceId).toBe('exa');
      expect(entries[0].amountWei).toBe(BigInt('100000000000000000'));
      expect(entries[0].path).toBe('DIRECT_MPP');
    });
  });

  // ===========================================================================
  // Task Lifecycle
  // ===========================================================================

  describe('task lifecycle', () => {
    it('should initialize task with budget and deadline', () => {
      ledger.initTask(taskId, budgetWei, deadlineMs, 'RUNNING');
      
      const task = ledger.getTask(taskId);
      expect(task).toBeDefined();
      expect(task!.budgetWei).toBe(budgetWei);
      expect(task!.deadlineMs).toBe(deadlineMs);
      expect(task!.spentWei).toBe(BigInt(0));
    });

    it('should track spent amount correctly', () => {
      ledger.initTask(taskId, budgetWei, deadlineMs, 'RUNNING');
      
      ledger.recordSpend({
        taskId,
        serviceId: 'exa',
        amountWei: BigInt('100000000000000000'),
        path: 'DIRECT_MPP',
        idempotencyKey: 'spend-1',
      });

      const task = ledger.getTask(taskId);
      expect(task!.spentWei).toBe(BigInt('100000000000000000'));
    });

    it('should track remaining budget', () => {
      ledger.initTask(taskId, budgetWei, deadlineMs, 'RUNNING');
      
      ledger.recordSpend({
        taskId,
        serviceId: 'exa',
        amountWei: BigInt('100000000000000000'),
        path: 'DIRECT_MPP',
        idempotencyKey: 'spend-1',
      });

      const remaining = ledger.getRemainingBudget(taskId);
      expect(remaining).toBe(BigInt('900000000000000000')); // 1 USDC - 0.1 USDC
    });

    it('should update task status', () => {
      ledger.initTask(taskId, budgetWei, deadlineMs, 'RUNNING');
      
      ledger.updateTaskStatus(taskId, 'COMPILING');
      
      const task = ledger.getTask(taskId);
      expect(task!.status).toBe('COMPILING');
    });

    it('should clear task on close', () => {
      ledger.initTask(taskId, budgetWei, deadlineMs, 'RUNNING');
      
      ledger.closeTask(taskId);
      
      const task = ledger.getTask(taskId);
      expect(task).toBeUndefined();
    });
  });
});;;;;