---
task: monitor-rjoa5
agent: Ledger
project: monitor
completed: 2026-03-20
files: []
tags: [audit, on-chain, verification, spend-ledger]
labels: []
priority: 3
type: task
---

# E2E Spend Audit — monitor-rjoa5

## Summary

Cross-verified on-chain MonitorTreasury events against backend spend ledger entries from the completed E2E smoke test (monitor-sbwku). Audit PASSED with noted limitation: the smoke test exercised only DIRECT_MPP and LLM payment paths, not the TREASURY on-chain spend path.

## Approach

1. Queried on-chain events via Foundry `cast logs` from block 10200000 to current
2. Verified TaskCreated and AgentAuthorized events match expected tasks
3. Confirmed zero SpendRecorded/TaskClosed events (expected - no TREASURY spends)
4. Reconciled backend ledger entries against on-chain state
5. Verified treasury USDC.e balance matches deposits minus spends

## On-Chain Findings

| Event | Count | TX Hashes |
|-------|-------|-----------|
| TaskCreated | 2 | `0xea49e702...`, `0x6df5865...` |
| AgentAuthorized | 2 | `0x2cfc5da5...`, `0xe3e055e4...` |
| SpendRecorded | 0 | N/A |
| TaskClosed | 0 | N/A |

### Key Transaction Hashes

- j4qhk demo: `createTask` `0xea49e702e8894a449f1801a5c18ef5647e7379477a1c7a2395a700d94840b70f`
- j4qhk demo: `authorizeAgent` `0x2cfc5da58b9332e35bf27123b5c6fe1721ba074ed8a3db6c4f0b1b1bc6005022`
- E2E smoke: `createTask` `0x6df586516e16b5f0ee31ef89927071997730c6d07ad767747e80aa970e9867cf`
- E2E smoke: `authorizeAgent` `0xe3e055e4c6f53d23a8609c7584042039220f9eea3730899bfee485ae3527712b`

## Backend Ledger Reconciliation

From `.sisyphus/evidence/monitor-e2e-api.txt`:
- Entry 1: `exa` service, DIRECT_MPP path, 10M wei (off-chain)
- Entry 2: `llm-synthesize`, LLM path, 500M wei (simulated)
- Total: 510M wei (no TREASURY-path entries)

## On-Chain State

- Treasury balance: 150,000 USDC.e micro-units (0.15 USDC)
- Task 0x414de35b...: budget 100K, spent0
- Task 0x9c4d16d0...: budget 50K, spent 0
- Both tasks: `isAuthorizedAgent(tempoWallet) = true`

## Decisions

1. Did NOT modify backend source code (read-only verification as specified)
2. Used standalone `cast` queries for on-chain verification
3. Documented unit mismatch (backend uses wei/10^18, on-chain uses USDC.e micro-units/10^6)

## Limitations

- TREASURY-path spend() and closeTask() flows not tested in smoke test
- Recommend creating dedicated on-chain spend test in follow-up task

## Evidence

`.sisyphus/evidence/monitor-e2e-audit.txt` (218 lines, gitignored)