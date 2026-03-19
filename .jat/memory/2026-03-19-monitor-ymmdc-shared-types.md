---
task: monitor-ymmdc
agent: Sisyphus
project: monitor
completed: 2026-03-19
files:
  - packages/shared/src/types.ts
  - packages/shared/src/types.test.ts
  - packages/shared/src/constants.ts
  - packages/shared/src/memo.ts
  - packages/shared/src/memo.test.ts
  - apps/backend/src/config.ts
  - apps/backend/src/config.test.ts
tags:
  - types
  - memo
  - config
  - env
  - shared
labels:
  - wave-1
  - foundation
priority: P0
type: task
---

# Define Shared Domain Types, Env Contracts, and Memo Format

## Summary

Enhanced the shared package with comprehensive domain types, memo encoding/decoding, and created backend environment configuration with fail-fast validation.

## Approach

1. Enhanced `packages/shared/src/types.ts` with:
   - TaskStatus lifecycle states with documentation
   - SpendEntry with SpendPath (TREASURY/DIRECT_MPP/LLM)
   - Task, EnhancementToggles, WSEvent interfaces
   - CreateTaskRequest/Response types
   - PROVIDER_IDS constant with all service identifiers

2. Implemented `packages/shared/src/memo.ts`:
   - 32-byte on-chain memo format
   - SERVICE_SLOTS mapping for consistent encoding
   - encodeMemo/decodeMemo functions with validation

3. Created `apps/backend/src/config.ts`:
   - Environment variable parsing
   - REQUIRED_ENV_VARS for fail-fast validation
   - DEFAULT_VALUES for optional vars
   - validateAddress helper

4. Added comprehensive constants in `packages/shared/src/constants.ts`:
   - Chain IDs (TEMPO_CHAIN_ID, ETHEREUM_CHAIN_ID)
   - Budget defaults (MIN/MAX/DEFAULT)
   - Gas limits for treasury operations
   - VALID_TRANSITIONS for state machine

## Decisions

- **Memo Format**: 16 bytes taskId + 8 bytes serviceId + 8 bytes queryIndex = 32 bytes
- **Service Slots**: Used ASCII strings padded/truncated to 8 chars for readability
- **Env Parsing**: Fail-fast on required vars, warn-only on missing LLM keys

## Key Files

| File | Purpose |
|------|---------|
| `packages/shared/src/types.ts` | Canonical domain types for all apps |
| `packages/shared/src/memo.ts` | On-chain memo encoding |
| `apps/backend/src/config.ts` | Backend environment config |
| `packages/shared/src/constants.ts` | Shared constants |

## Tests

- types.test.ts: 14 tests
- memo.test.ts: 16 tests  
- config.test.ts: 17 tests
- Total: 51 tests passing