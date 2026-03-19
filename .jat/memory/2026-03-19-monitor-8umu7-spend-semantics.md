---
task: monitor-8umu7
agent: Sisyphus
project: monitor
completed: 2026-03-19
files:
  - apps/backend/src/spend-ledger.ts
  - apps/backend/src/spend-ledger.test.ts
  - packages/shared/src/spend-policy.ts
  - packages/shared/src/spend-policy.test.ts
  - .sisyphus/evidence/monitor-8umu7-red.txt
  - .sisyphus/evidence/monitor-8umu7-green.txt
tags:
  - tdd
  - spend-ledger
  - budget
  - idempotency
  - validation
labels:
  - wave-1
  - tdd-compliant
priority: P0
type: task
---

# Freeze Spend Semantics Before Implementation

## Summary

Implemented spend reconciliation rules using strict TDD workflow. Created SpendLedger class with budget/deadline enforcement and idempotency strategy.

## TDD Workflow

### RED Phase
- Wrote 23 failing tests for spend-ledger.test.ts
- Tests covered: budget enforcement, deadline checks, idempotency, status validation
- Evidence saved to monitor-8umu7-red.txt

### GREEN Phase  
- Implemented spend-ledger.ts SpendLedger class
- All 23 tests passed
- Evidence saved to monitor-8umu7-green.txt

### REFACTOR Phase
- Created spend-policy.ts for shared validation logic
- Added 14 additional tests for policy functions
- Total: 88 tests passing

## Key Features

### Budget Enforcement
- Rejects spend exceeding remaining budget
- Tracks totals across TREASURY/DIRECT_MPP/LLM paths
- Returns spent amount in result for UI consistency

### Deadline Enforcement
- Rejects spend after deadline timestamp
- Uses current time for comparison

### Idempotency
- Duplicate idempotency keys rejected
- Same service with different keys allowed
- Per-task key namespace (taskId:key)

### Status Enforcement
- Only ACTIVE_STATUSES allow spend: FUNDING, RUNNING, COMPILING, ENHANCING
- Terminal statuses block: COMPLETE, FAILED, STOPPED

## SpendLedger API

```typescript
interface SpendLedger {
  initTask(taskId, budgetWei, deadlineMs, status)
  recordSpend({ taskId, serviceId, amountWei, path, idempotencyKey }): SpendResult
  getTotals(taskId): { totalWei, byPath }
  getEntries(taskId): SpendLedgerEntry[]
  getRemainingBudget(taskId): bigint
  updateTaskStatus(taskId, status)
  closeTask(taskId)
}
```

## SpendPolicy Functions

- `isTaskActive(status)` - Check if task allows spend
- `validateBudget(current, budget, requested)` - Budget validation
- `validateDeadline(deadlineMs)` - Deadline validation
- `validateSpend(state, amount, idempotencyKey, seenKeys)` - Comprehensive check
- `aggregateSpends(entries)` - Total aggregation by path/service

## Source of Truth

```typescript
SOURCE_OF_TRUTH = {
  TREASURY: 'on-chain',      // Verified via contract events
  DIRECT_MPP: 'backend',     // Reconciled from MPP receipts
  LLM: 'backend',            // From LLM provider billing
}
```

## Next Steps

Task 4 (monitor-qlk0a) - Implement MonitorTreasury contract:
- Use SpendLedger for backend tracking
- Reference spend-policy validation rules
- Match semantics: budget/deadline/idempotency