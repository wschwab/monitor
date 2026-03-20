---
task: monitor-sbwku
agent: Tempest
project: monitor
completed: 2026-03-20
files:
  - apps/backend/src/index.ts
  - apps/backend/src/e2e-smoke.ts
  - contracts/script/E2ESmokeTest.s.sol
tags: [e2e, backend, agentengine, spend-ledger, permit2, tempo]
labels: []
priority: 2
type: task
---

## Summary
E2E backend smoke test verifying the full task lifecycle end-to-end using in-process services
and Tempo mainnet on-chain calls.

## Approach
Rather than fighting subprocess management (bash background processes killed when commands exit),
wrote `apps/backend/src/e2e-smoke.ts` — a self-contained in-process runner that imports
TaskManager, SpendLedger, and AgentEngine directly (no HTTP/WebSocket overhead).

Also added three missing backend pieces to `index.ts`:
1. `serializeBigInt()` — Fastify's JSON serializer can't handle BigInt, all task responses need this
2. `POST /tasks/:id/status` — status transition endpoint (CREATED→FUNDING→RUNNING etc.)
3. `POST /tasks/:id/run` — triggers full AgentEngine.run() loop

## Key Decisions
- **In-process E2E over subprocess**: `pnpm dev` background processes are killed when the parent
  bash command exits in pi; in-process avoids this entirely
- **SpendLedger stays RUNNING**: AgentEngine transitions taskManager status (RUNNING→COMPILING→COMPLETE)
  but never updates SpendLedger; patched transitionStatus to sync SpendLedger for COMPILING/ENHANCING
- **Permit2 nonce=1**: nonce=0 consumed by monitor-j4qhk AuthorizeAgent.s.sol; used nonce=1 for E2E

## Key Files
- `apps/backend/src/index.ts` — three new endpoints + BigInt fix
- `apps/backend/src/e2e-smoke.ts` — self-contained in-process E2E runner
- `contracts/script/E2ESmokeTest.s.sol` — on-chain Permit2 smoke test (keccak256("monitor-e2e-smoke-test"))
- `.sisyphus/evidence/monitor-e2e-api.txt` — full evidence log

## Results
- Backend: CREATED→FUNDING→RUNNING→COMPILING→COMPLETE ✓
- DIRECT_MPP spend: exa 10^16 wei; LLM: 5×10^17 wei; total 5.1×10^17 wei
- Rehydrate: 7 feed entries (status×4 + query + reasoning + complete) ✓
- On-chain TX: 0x6df586516e16b5f0ee31ef89927071997730c6d07ad767747e80aa970e9867cf
- Treasury balance: 150,000 USDC.e (cumulative from j4qhk + this test)
- 102/102 tests pass

## Lessons
- pi bash background processes (`&`) are killed when the command timeout/exits — always test in-process
- Fastify needs explicit BigInt→string conversion; add serializeBigInt to all routes returning TaskRecord
- SpendLedger and TaskManager are separate state machines; must sync them manually during transitions
