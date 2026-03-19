---
task: monitor-yof3b
agent: Sisyphus
project: monitor
completed: 2026-03-19
files:
  - apps/backend/src/agent-engine.ts
  - apps/backend/src/agent-engine.test.ts
  - apps/backend/src/tools/llm.ts
  - README.md
tags:
  - agent-loop
  - llm
  - synthesis
  - budget-aware
  - tdd
labels:
  - wave-5
  - tdd-compliant
priority: P3
type: task
---

# Add LLM Synthesis Path and Deterministic Agent Loop

## Summary

Built AgentEngine: budget-aware tool execution loop + LLM synthesis via Anthropic.
Demo mode returns deterministic markdown report. Partial report on budget exhaustion.
Emergency stop check between each tool step. README tagline updated.

## TDD

- RED: 15 failing tests (agent-engine.ts not found)
- GREEN: All 15 pass; 177 total across monorepo

## Key Files

- `apps/backend/src/agent-engine.ts` — AgentEngine with run(), synthesize(), selectTools()
- `apps/backend/src/agent-engine.test.ts` — 15 tests: full run, budget exhaustion, stop, LLM paths
- `apps/backend/src/tools/llm.ts` — LLMAdapter: Anthropic live + demo fallback + injectable fn

## Decisions

### LLM Cost Reserve
`selectTools()` subtracts `LLM_SYNTHESIS_COST_WEI` (0.5 ETH) from remaining budget
before allocating tool slots. Ensures synthesis is always affordable.

### Partial Report
When budget is too small even for tool selection (`task.sources.length > 0 && toolPlans.length === 0`),
`partial = true` immediately. Report includes a prominent note about budget exhaustion.

### Injectable LLMCallFn
`LLMAdapter` accepts `llmCallFn` option — allows tests to mock the LLM call without
hitting real APIs. Pattern mirrors ExaAdapter's `fetchFn`.

### Feed Entries
AgentEngine emits: `query` before each tool, `reasoning` before synthesis, `complete` at end.
TaskManager state transitions: RUNNING → COMPILING → COMPLETE.

## Next Steps

Task 10 (monitor-uqo6w): Build web task creation and live feed UI
- Task form with prompt, budget, deadline, source toggles
- WebSocket-connected live feed page
- Next.js + React components
