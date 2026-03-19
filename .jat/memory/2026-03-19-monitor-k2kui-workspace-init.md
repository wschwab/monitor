---
task: monitor-k2kui
agent: Sisyphus
project: monitor
completed: 2026-03-19
files:
  - package.json
  - turbo.json
  - pnpm-workspace.yaml
  - .nvmrc
  - tsconfig.json
  - apps/backend/package.json
  - apps/web/package.json
  - apps/data-proxy/package.json
  - packages/shared/package.json
  - contracts/foundry.toml
  - packages/shared/src/types.ts
  - packages/shared/src/constants.ts
  - packages/shared/src/memo.ts
tags:
  - workspace
  - monorepo
  - typescript
  - foundry
  - foundation
labels:
  - wave-0
  - foundation
priority: P0
type: task
---

# Validate Workspace and Freeze Tooling

## Summary

Initialized the monitor monorepo with pnpm workspaces, Turborepo orchestration, TypeScript project references, and Foundry for Solidity contracts. All verification commands passing.

## Approach

1. Analyzed existing skeleton directories
2. Created root config files (turbo.json, .nvmrc, pnpm-workspace.yaml)
3. Added package.json for each workspace app with appropriate dependencies
4. Set up TypeScript configs with composite project references
5. Initialized Foundry with forge-std dependency
6. Created shared types/constants/memo module in packages/shared
7. Added placeholder tests for all packages
8. Verified with `pnpm install`, `pnpm typecheck`, `pnpm test`, `forge test`

## Decisions

- **Package Manager**: pnpm@9.0.0 - efficient disk space, strict dependency resolution, built-in workspace support
- **Build Orchestrator**: Turborepo 2.x - task caching, parallel execution
- **Node.js Version**: 20.11.0 - LTS with latest features
- **Test Runner**: Vitest - fast, ESM-native, compatible with TypeScript

## Key Files

| File | Purpose |
|------|---------|
| `turbo.json` | Task orchestration (build, test, typecheck, lint) |
| `pnpm-workspace.yaml` | Workspace definition (apps/*, packages/*) |
| `packages/shared/src/types.ts` | Canonical domain types (TaskStatus, SpendEntry, WSEvent) |
| `packages/shared/src/memo.ts` | 32-byte on-chain memo encoding/decoding |
| `contracts/foundry.toml` | Solidity build config with Tempo RPC endpoint |

## Next Steps

Task 2 (monitor-ymmdc) can now proceed:
- Extend packages/shared/src/types.ts with env contracts
- Use packages/shared/src/constants.ts for chain IDs and addresses