---
task: monitor-ewxd9
agent: Sisyphus
project: monitor
completed: 2026-03-19
files:
  - apps/backend/src/premium-executor.ts
  - apps/backend/src/premium-executor.test.ts
  - apps/data-proxy/src/premium/cern-temporal.ts
  - .sisyphus/evidence/monitor-ewxd9-red.txt
  - .sisyphus/evidence/monitor-ewxd9-green.txt
tags:
  - premium
  - treasury
  - tdd
  - cern
  - cia
labels:
  - wave-3
  - tdd-compliant
priority: P2
type: task
---

# Build Premium Mock Provider Seam and Treasury-backed Billing Path

## Summary

Implemented PremiumExecutor with Treasury-backed billing for premium data providers (CERN, CIA). Custom adapter seam using spend-ledger instead of mppx.charge.

## TDD Workflow

### RED Phase
- Wrote 15 failing tests for premium-executor
- Tests covered: CERN/CIA fetch, treasury debit, 404 handling, budget checks
- Evidence saved to monitor-ewxd9-red.txt

### GREEN Phase
- Implemented PremiumExecutor with full functionality
- Added CERN provider with scientific fixtures
- All 15 tests passed
- Evidence saved to monitor-ewxd9-green.txt

## PremiumExecutor

### Usage
```typescript
const executor = new PremiumExecutor({
  spendLedger,
  treasuryAddress: '0x...',
});

const result = await executor.fetchPremiumData({
  taskId: 'task-123',
  provider: 'cern-temporal',
  query: 'Higgs boson discovery',
});
```

### Features
- Budget check before spending
- Treasury debit via spend-ledger (custom seam, not mppx.charge)
- Idempotency key generation
- 404 handling without retries or budget spend
- Graceful error handling

### Premium Costs
- cern-temporal: 0.1 ETH
- cia-declassified: 0.1 ETH

## CERN Provider

Mock data fixtures for:
- Higgs boson discovery (2012)
- Standard Model particles
- LHC experiments
- Dark matter search

## Test Coverage

15 tests covering:
- Provider fetch and spend
- Treasury debit verification
- Audit entry recording
- 404 handling without spend
- Budget insufficient rejection
- Custom adapter seam
- Idempotency key usage
- Error handling
- No retry on 404
- Spend consistency

## Test Count

- backend: 56 tests
- data-proxy: 18 tests
- shared: 44 tests
- web: 1 test
- contracts: 25 tests
- **Total: 144 tests passing**

## Next Steps

Task 7 (monitor-zte2i) - Build backend task manager:
- Add websocket server
- Create fake tool executor
- Integrate premium executor into tool flow