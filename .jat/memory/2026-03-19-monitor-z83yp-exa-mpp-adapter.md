---
task: monitor-z83yp
agent: Sisyphus
project: monitor
completed: 2026-03-19
files:
  - apps/backend/src/mpp-client.ts
  - apps/backend/src/tools/exa.ts
  - apps/backend/src/tools/exa.test.ts
  - apps/backend/src/tools/executor.ts
  - apps/backend/src/spend-ledger.ts
  - README.md
tags:
  - mpp
  - exa
  - 402-payment
  - spend-reconciliation
  - tdd
  - steins-gate
labels:
  - wave-5
  - tdd-compliant
priority: P3
type: task
---

# Add Real Direct-MPP Provider Adapters and Direct Spend Reconciliation

## Summary

Implemented `MPPClient` factory and `ExaAdapter` for real direct-MPP provider calls with
402-payment-required flow, idempotency deduplication, and spend-ledger reconciliation.
Also updated README: Higgs Boson scenario replaced with Hououin Kyouma CERN classified
dossier (Steins;Gate reference). El Psy Kongroo.

## TDD Workflow

- **RED**: 12 failing tests (exa.ts not found)
- **GREEN**: All 12 pass + 162 total across monorepo

## Key Files

- `apps/backend/src/mpp-client.ts` — Generic HTTP client: 402 detection, auth headers,
  timeout via AbortController, idempotency header forwarding
- `apps/backend/src/tools/exa.ts` — ExaAdapter: demo fixtures (Hououin Kyouma dossier),
  live 402 flow, budget gate, fallbackToDemo safety
- `apps/backend/src/tools/exa.test.ts` — 12 tests covering all paths
- `apps/backend/src/spend-ledger.ts` — Added `createTask`, `getSpendTotals`,
  `getTaskEntries` convenience aliases (backward compatible)

## Decisions

### 402 Flow
On 402 response: parse `amountWei` from body → `recordSpend()` → retry with `-retry`
suffix on idempotency key. One spend entry per logical call even across retries.

### Idempotency Deduplication
SpendLedger rejects duplicate `idempotencyKey` per task. Exa adapter generates
`exa-{taskId}-{timestamp}` keys by default; callers can override for determinism.

### fallbackToDemo
`ExaAdapter` accepts `fallbackToDemo: true`. On any network/timeout error it returns
demo fixture data tagged `fromDemo: true`. Process never crashes on provider failure.

### Budget Gate in Demo Mode
Budget enforcement runs even in demo mode — recordSpend still goes through SpendLedger,
so a task with 1 wei budget correctly rejects an Exa call (0.01 ETH needed).

### Executor Wiring
`FakeToolExecutor` now accepts `spendLedger` + `exaApiKey`. When both present it
instantiates a real `ExaAdapter` with `fallbackToDemo: true`. Old inline fixture
path retained as final fallback (no ledger configured).

## README Change
Replaced Higgs Boson demo scenario with Steins;Gate reference:
- Scenario: "Uncover the Classified CERN Dossier on Hououin Kyouma"
- Live feed shows: "Retrieved dossier: Subject 'Hououin Kyouma', threat level: DIVERGENT"
- Demo fixtures match: CERN classified archive results with temporal divergence meter readings

## Next Steps

Task 9 (monitor-yof3b): Add LLM synthesis path and deterministic agent loop
- Anthropic/OpenAI adapter with demo fallback
- Budget-aware tool execution loop
- Partial report on budget exhaustion
