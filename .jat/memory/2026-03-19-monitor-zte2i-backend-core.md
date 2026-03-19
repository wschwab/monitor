---
task: monitor-zte2i
agent: Sisyphus
project: monitor
completed: 2026-03-19
files:
  - apps/backend/src/task-manager.ts
  - apps/backend/src/task-manager.test.ts
  - apps/backend/src/ws-server.ts
  - apps/backend/src/tools/definitions.ts
  - apps/backend/src/tools/executor.ts
  - apps/backend/src/index.ts
  - packages/shared/src/types.ts
  - README.md
  - .sisyphus/evidence/monitor-zte2i-red.txt
  - .sisyphus/evidence/monitor-zte2i-green.txt
tags:
  - backend
  - websocket
  - state-machine
  - tdd
  - readme
labels:
  - wave-4
  - tdd-compliant
priority: P2
type: task
---

# Build Backend Task Manager, WebSocket Server, and Fake Tool Executor

## Summary

Built complete backend core with task state machine, real-time WebSocket feeds, and fake tool executor for demo mode. Also created comprehensive, entertaining README.md.

## TDD Workflow

### RED Phase
- Wrote 19 failing tests for TaskManager state transitions
- Tests covered: create, transitions, feed entries, rehydration, emergency stop
- Evidence saved to monitor-zte2i-red.txt

### GREEN Phase
- Implemented TaskManager with full state machine
- Created WSServer for WebSocket broadcasts
- Built FakeToolExecutor with 8 tools
- Added REST API endpoints
- All 19 tests passed + created entertaining README
- Evidence saved to monitor-zte2i-green.txt

## Task Manager State Machine

```
CREATED → FUNDING → RUNNING → COMPILING → ENHANCING → COMPLETE
   ↓         ↓          ↓           ↓            ↓
 FAILED   STOPPED    FAILED      FAILED       FAILED
```

## WebSocket Server

- Port 3002, path `/ws?taskId={id}`
- Broadcasts: feed_entry, status_change, complete, error
- Real-time updates to all subscribed clients

## REST API Endpoints

- `POST /tasks` - Create task
- `GET /tasks` - List with filters
- `GET /tasks/:id` - Get task
- `GET /tasks/:id/rehydrate` - Full state for refresh
- `POST /tasks/:id/stop` - Emergency stop
- `POST /tasks/:id/execute` - Execute tool

## Fake Tool Executor

8 simulated tools:
- Direct MPP: exa (0.01), perplexity (0.05), allium (0.02)
- Premium: cern-temporal (0.10), cia-declassified (0.10)
- LLM: llm-synthesize (0.50)
- Enhancement: cover-image (0.20), audio-briefing (0.15)

## README.md

Comprehensive documentation with:
- Entertaining tone and emojis
- Architecture diagram
- Demo scenario
- Tech stack with personality
- Quick start guide
- Honest limitations section

## Test Count

- backend: 75 tests
- data-proxy: 18 tests
- shared: 56 tests
- web: 1 test
- contracts: 25 tests
- **Total: 175 tests passing**

## Next Steps

Task 8 (monitor-z83yp) - Real MPP adapters:
- Exa adapter with real API
- 402 payment handling
- Direct spend reconciliation