---
task: monitor-joerl
agent: SteepSteppe
project: monitor
completed: 2026-03-20
files:
  - apps/backend/src/e2e-exa-tempo.ts
  - .sisyphus/evidence/monitor-e2e-exa.txt
tags: [e2e, tempo, exa, mpp, payment]
labels: [testing, payments, tempo]
priority: 3
type: task
---

# monitor-joerl: E2E Real Exa Provider Payment Flow via Tempo

## Summary

Verified real Exa API calls through Tempo's MPP gateway (`exa.mpp.tempo.xyz`) with payment flow:
- Created `e2e-exa-tempo.ts` -executes real paid searches via Tempo CLI
- Confirmed wallet balance deductions (0.005 USDC per search)
- Documented idempotency behavior (Tempo MPP does NOT honor Idempotency-Key header)
- All acceptance criteria passed

## Key Findings

### Idempotenty Issue
**Tempo's MPP gateway does NOT honor the `Idempotency-Key` header.**
- Same idempotency key = two different request IDs = two charges
- Backend must implement its own deduplication (use requestId or local tracking)

### Payment Flow
- Each Exa search costs $0.007 (0.005 USDC via Tempo)
- Payments are off-chain micropayments from wallet spending capacity
- No on-chain tx hashes for individual API calls

### Architecture Note
Backend's `ExaAdapter` should use Tempo's service URL (`https://exa.mpp.tempo.xyz`) instead of `api.exa.ai`. Auth flows through Tempo's signature system.

## On-Chain References

See monitor-j4qhk for on-chain setup:
- MonitorTreasury: `0x95c9009c82FEd445dEDeecEfC2abA6edEb920941`
- Wallet: `0x016bbbec8fb7cf59c0baa082f056eb650368051d`

## Test Results

```
Test Files  7 passed (7)Tests  102 passed (102)
```

## Evidence

`.sisyphus/evidence/monitor-e2e-exa.txt`:
- Real CERN search results (not demo fixtures)
- Wallet balance deltas
- Request IDs from Tempo MPP