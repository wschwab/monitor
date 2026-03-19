# Monitor Executor Work Plan

> **For Sisyphus:** Execute this plan in narrow waves. Prefer the smallest working end-to-end demo over protocol maximalism.

## TL;DR

> Build a weekend-safe Monitor MVP that proves one core story: a user funds an AI research task, the agent pays for data and its own reasoning, and the app returns a report plus an auditable spend log and refund.
>
> Freeze scope aggressively. Must-ship is: one contract, one backend, one proxy, one real direct-MPP provider, one premium mock provider, one LLM path, one enhancement, and one clean UI flow.

## Scope Freeze

### Must Ship
- Contract-backed task budget with refund path
- Direct MPP payment path for at least one live provider (`Exa`)
- One premium Treasury-backed source (`CERN` or `CIA`)
- One LLM path for report synthesis
- Task creation, live feed, results + audit UI
- Deterministic demo mode

### Should Ship
- Real Tempo/WebAuthn passkey flow
- Fee sponsorship
- Cover image enhancement
- Additional direct provider (`Allium`)

### Stretch Only
- Audio briefing
- Upload/email delivery
- 2D nonces demo
- True session-heavy behavior across multiple providers
- `SplitSettlement.sol`
- MCP transport
- Mobile polish beyond basic layout safety

## Non-Negotiable Guardrails

- One canonical spend truth per flow:
  - Treasury-backed premium spend -> on-chain treasury log
  - Direct MPP spend -> backend ledger mirrored into UI and reconciled into totals
- `recordSpend()` must not bypass budget/deadline rules
- Demo must work in `demo mode` even if live providers fail
- Enhancements are individually toggleable; do not assume the whole bundle ships
- Do not block MVP on passkeys, fee sponsorship, batching, or 2D nonces
- Backend persistence is intentionally in-memory; restart losing live tasks is acceptable for MVP if explicitly surfaced

## Repo Validation First

Before coding any feature, validate the repo matches the intended monorepo shape from `.sisyphus/plans/monitor-expanded-spec.md`.

- Confirm package manager and workspace tool
- Confirm actual package/app names
- Confirm test runners for frontend/backend/contracts
- Confirm whether `turbo.json` exists or is needed

## Verification Strategy

### Canonical Commands

Executors must establish and then reuse exact commands for every wave:

```bash
# workspace install
<package-manager> install

# contracts
forge test

# backend tests
<package-manager> --filter backend test

# frontend tests
<package-manager> --filter web test

# typecheck
<package-manager> --filter web typecheck
<package-manager> --filter backend typecheck

# end-to-end / smoke
<package-manager> --filter web test:e2e
```

### Required QA Themes

- Happy path: funded task -> agent runs -> report renders -> refund shown
- Failure path: provider failure -> partial report still completes
- Budget path: overspend attempt is blocked
- Emergency path: stop task prevents further work and returns remaining budget
- Toggle path: disabled enhancements never incur charges
- Demo path: offline/demo mode produces deterministic results

---

## Execution Strategy

### Wave 0 - Reality Check
- Validate actual repo/workspace structure before freezing implementation file paths
- Create minimal monorepo/workspace scaffolding only if missing
- Freeze package manager, test runner, and shared commands

### Wave 1 - Shared Semantics
- Define shared types, memo format, env contracts, and spend semantics
- Resolve `spend()` vs `recordSpend()` behavior before adapter work

### Wave 2 - Contract Foundation
- Implement and test `MonitorTreasury.sol`
- Ship budget, deadline, refund, and premium-spend semantics

### Wave 3 - Proxy + Premium Mocks
- Stand up `apps/data-proxy`
- Ship one real wrapped API and one premium mock provider
- Add demo-mode fixtures and deterministic outputs

### Wave 4 - Backend Core
- Build task state machine, websocket broadcasting, tool registry, fake executor path
- Make end-to-end flow work with stubs before live providers

### Wave 5 - Real MPP Integration
- Add direct MPP adapters for `Exa`
- Add one LLM synthesis adapter
- Reconcile direct MPP spend into backend totals

### Wave 6 - Frontend Flow
- Build task form, live feed, results, and audit surfaces
- Wire to backend state and websocket events

### Wave 7 - Polish + Demo Safety
- Add one enhancement (cover image recommended)
- Add demo-mode switch and scripted prompt
- Produce final smoke/e2e proof

---

## TODOs

- [ ] **Task 1: Validate workspace and freeze tooling** *(Wave 0, blocks all)*
- [ ] **Task 2: Define shared domain types, env contracts, and memo format** *(Wave 1, blocks 3–7)*
- [ ] **Task 3: Freeze spend semantics before implementation** *(Wave 1, blocks 4, 6, 7)*
- [ ] **Task 4: Implement and test MonitorTreasury contract** *(Wave 2, blocks 7, 8)*
- [ ] **Task 5: Build proxy foundation with one wrapped real source and demo-mode fixtures** *(Wave 3, blocks 6, 8, 9)*
- [ ] **Task 6: Build premium mock provider seam and custom Treasury-backed billing path** *(Wave 3, blocks 8, 9)*
- [ ] **Task 7: Build backend task manager, websocket server, and fake tool executor** *(Wave 4, blocks 8, 9, 10)*
- [ ] **Task 8: Add real direct-MPP provider adapters and direct spend reconciliation** *(Wave 5, blocks 9, 10)*
- [ ] **Task 9: Add one LLM synthesis path and deterministic agent loop** *(Wave 5, blocks 10, 11)*
- [ ] **Task 10: Build web task creation and live feed UI** *(Wave 6, blocks 11)*
- [ ] **Task 11: Build results + audit UI with spend consistency checks** *(Wave 6, blocks 12)*
- [ ] **Task 12: Add one enhancement and finalize demo mode** *(Wave 7, blocks final verification)*
- [ ] **Task 13: Optional polish wave after MVP is green** *(Wave 7 optional, no blocks)*

---

### Task 1: Validate workspace and freeze tooling

**Wave**: 0  
**Depends on**: none  
**Blocks**: all subsequent tasks

**Files:**
- Create or modify root `package.json`
- Create or modify root `turbo.json` only if needed
- Create or modify workspace package manifests under `apps/` and `packages/`
- Create `.nvmrc` or equivalent only if the repo standard needs it

**Steps:**
1. Inspect actual repo contents and compare against `.sisyphus/plans/monitor-expanded-spec.md:1218`.
2. Choose one package manager and write it into the root scripts by convention.
3. Add canonical scripts for install, test, typecheck, lint, and dev boot.
4. Add a short root note or script names that make boot commands discoverable.
5. Run install + no-op test/typecheck commands to prove the workspace boots.

**Acceptance Criteria:**
- Root workspace command set exists and is consistent.
- All planned package paths exist or are intentionally deferred.
- Executors can run one install command and one test command from repo root.

**QA:**
- Command: chosen install command succeeds.
- Command: root test/typecheck scripts exit 0 or intentionally report no tests yet.
- Evidence: `.sisyphus/evidence/task-1-workspace.txt`

**Commit:** `chore(workspace): initialize monitor monorepo tooling`

### Task 2: Define shared domain types, env contracts, and memo format

**Wave**: 1  
**Depends on**: Task 1  
**Blocks**: Tasks 3, 4, 5, 6, 7

**Files:**
- Create `packages/shared/src/types.ts`
- Create `packages/shared/src/constants.ts`
- Create `packages/shared/src/memo.ts`
- Create `packages/shared/package.json`
- Create `apps/backend/src/config.ts`
- Create `apps/web/lib/types.ts` only if direct re-export is simpler than shared import

**Steps:**
1. Write failing tests for memo encoding/decoding and shared task/spend type expectations.
2. Define canonical `TaskStatus`, `SpendEntry`, `WSEvent`, enhancement toggles, and provider IDs.
3. Define memo format that fits 32 bytes; document exact field widths and truncation/hash policy.
4. Define env parsing rules and required/optional variables for web/backend/proxy.
5. Add constants for pathUSD, chain IDs, and treasury placeholders.

**Acceptance Criteria:**
- One canonical memo encoder/decoder exists.
- Shared provider IDs exactly match backend tools and UI selectors.
- Env parsing fails fast on missing required values.

**QA:**
- Command: shared package test command passes.
- Scenario: encode/decode `taskId/serviceId/queryIndex` round-trips.
- Scenario: oversize service ID fails with explicit error.
- Evidence: `.sisyphus/evidence/task-2-shared.txt`

**Commit:** `feat(shared): add monitor domain types and memo format`

### Task 3: Freeze spend semantics before implementation

**Wave**: 1  
**Depends on**: Task 2  
**Blocks**: Tasks 4, 6, 7

**Files:**
- Modify `contracts/src/MonitorTreasury.sol`
- Create `apps/backend/src/spend-ledger.ts`
- Create `apps/backend/src/spend-ledger.test.ts`
- Create `packages/shared/src/spend-policy.ts` if helpful

**Steps:**
1. Write failing tests for `recordSpend()` budget/deadline enforcement and duplicate-record prevention.
2. Decide exact source-of-truth rules for premium, direct MPP, and UI totals.
3. Add idempotency key strategy for direct MPP ledger entries.
4. Define behavior when a task closes during in-flight requests.

**Acceptance Criteria:**
- `recordSpend()` path cannot overspend or bypass deadline semantics.
- Duplicate direct-MPP charges are ignored or rejected deterministically.
- Backend exposes one total-spend number regardless of payment path.

**QA:**
- Command: backend unit tests for ledger pass.
- Scenario: duplicate `recordSpend()` with same idempotency key does not increment totals twice.
- Scenario: stopped task rejects further spend recording.
- Evidence: `.sisyphus/evidence/task-3-spend-semantics.txt`

**Commit:** `feat(accounting): define spend reconciliation rules`

### Task 4: Implement and test MonitorTreasury contract

**Wave**: 2  
**Depends on**: Tasks 2, 3  
**Blocks**: Tasks 7, 8

**Files:**
- Modify `contracts/src/MonitorTreasury.sol`
- Create `contracts/test/MonitorTreasury.t.sol`
- Create `contracts/script/Deploy.s.sol`
- Create `contracts/foundry.toml`

**Steps:**
1. Write failing contract tests for `createTask`, `spend`, `recordSpend`, `closeTask`, unauthorized access, expired deadline, overspend, and refund.
2. Implement minimal contract code to satisfy tests.
3. Add deployment script targeting Tempo testnet values from env.
4. Keep `SplitSettlement.sol` out of scope for this wave.

**Acceptance Criteria:**
- `createTask()` uses `transferFrom`, not `transfer`.
- `spend()` enforces active/deadline/budget/allowlist/agent identity.
- `recordSpend()` matches the agreed spend-policy behavior.
- `closeTask()` refunds remaining balance and prevents further writes.

**QA:**
- Command: `forge test` passes.
- Scenario: unauthorized account calling `spend()` reverts.
- Scenario: close after partial spend refunds the difference.
- Evidence: `.sisyphus/evidence/task-4-forge.txt`

**Commit:** `feat(contracts): add monitor treasury budget controls`

### Task 5: Build proxy foundation with one wrapped real source and demo-mode fixtures

**Wave**: 3  
**Depends on**: Tasks 1, 2  
**Blocks**: Tasks 6, 8, 9

**Files:**
- Create `apps/data-proxy/src/index.ts`
- Create `apps/data-proxy/src/services/defi-stats.ts`
- Create `apps/data-proxy/src/services/news.ts` only if needed for demo prompt
- Create `apps/data-proxy/src/demo-fixtures.ts`
- Create `apps/data-proxy/package.json`

**Steps:**
1. Write failing tests for proxy discovery endpoints and one wrapped route.
2. Implement `mppx/proxy` with at least one real wrapped source (`defi-stats`).
3. Add `demo mode` fixture responses for offline/no-provider execution.
4. Expose one environment switch for live vs demo behavior.

**Acceptance Criteria:**
- `GET /discover` and `GET /llms.txt` return usable descriptions.
- One wrapped provider route responds in live mode and fixture mode.
- Demo mode returns deterministic content for the canonical hackathon prompt.

**QA:**
- Command: proxy tests pass.
- Scenario: `GET /discover` includes `defi-stats`.
- Scenario: demo-mode request returns fixed fixture without upstream dependency.
- Evidence: `.sisyphus/evidence/task-5-proxy.txt`

**Commit:** `feat(proxy): add wrapped provider and demo fixtures`

### Task 6: Build premium mock provider seam and custom Treasury-backed billing path

**Wave**: 3  
**Depends on**: Tasks 3, 4, 5  
**Blocks**: Tasks 8, 9

**Files:**
- Create `apps/data-proxy/src/premium/cern-temporal.ts`
- Create `apps/data-proxy/src/premium/cia-declassified.ts`
- Create `apps/backend/src/premium-executor.ts`
- Create `apps/backend/src/premium-executor.test.ts`

**Steps:**
1. Write failing tests for premium source fetch + treasury debit + audit entry behavior.
2. Implement one premium provider first (`cern-temporal` recommended).
3. Build the custom adapter seam that debits budget via treasury/client logic before returning fixture data.
4. Add 404/no-data handling without retries.
5. Add second premium provider only after first path passes.

**Acceptance Criteria:**
- Premium provider path does not assume stock `mppx.charge(...)` solves Treasury billing.
- Successful premium request produces data plus premium spend entry.
- Premium 404 returns no data and does not crash report compilation.

**QA:**
- Command: backend premium tests pass.
- Scenario: valid premium query increments premium spend exactly once.
- Scenario: missing premium record produces graceful no-data result.
- Evidence: `.sisyphus/evidence/task-6-premium.txt`

**Commit:** `feat(premium): add treasury-backed premium source flow`

### Task 7: Build backend task manager, websocket server, and fake tool executor

**Wave**: 4  
**Depends on**: Tasks 2, 3, 4  
**Blocks**: Tasks 8, 9, 10

**Files:**
- Create `apps/backend/src/index.ts`
- Create `apps/backend/src/task-manager.ts`
- Create `apps/backend/src/ws-server.ts`
- Create `apps/backend/src/tools/definitions.ts`
- Create `apps/backend/src/tools/executor.ts`
- Create `apps/backend/src/task-manager.test.ts`

**Steps:**
1. Write failing tests for task state transitions: `CREATED -> FUNDING -> RUNNING -> COMPILING -> ENHANCING -> COMPLETE` and failure/stop branches.
2. Implement in-memory task store and websocket broadcaster.
3. Add a fake tool executor that simulates direct provider, premium provider, and enhancement events.
4. Add rehydrate endpoint for `/task/:id` page refreshes during a run.

**Acceptance Criteria:**
- Backend can run end-to-end with fake tools and no live providers.
- Refreshing a running task rehydrates status and accumulated feed entries from memory.
- Emergency stop prevents subsequent executor steps.

**QA:**
- Command: backend tests pass.
- Scenario: fake run emits status, query, reasoning, and completion websocket events in order.
- Scenario: emergency stop ends run with no additional executor events afterward.
- Evidence: `.sisyphus/evidence/task-7-backend.txt`

**Commit:** `feat(backend): add task engine and live feed state machine`

### Task 8: Add real direct-MPP provider adapters and direct spend reconciliation

**Wave**: 5  
**Depends on**: Tasks 3, 5, 7  
**Blocks**: Tasks 9, 10

**Files:**
- Create `apps/backend/src/mpp-client.ts`
- Create `apps/backend/src/tools/exa.ts`
- Create `apps/backend/src/tools/allium.ts` only if time permits
- Create `apps/backend/src/tools/exa.test.ts`
- Modify `apps/backend/src/tools/executor.ts`

**Steps:**
1. Write failing adapter tests using mocked 402/payment flows and spend-ledger writes.
2. Implement `mppx` client factory for direct provider requests.
3. Ship `Exa` as the first mandatory live provider.
4. Record direct spend through the reconciled backend ledger.
5. Add live-provider timeout/fallback path into demo mode.

**Acceptance Criteria:**
- One real direct-MPP provider (`Exa`) works in live mode.
- Provider failure falls back to partial-report-safe behavior.
- Direct provider charges appear in backend totals and UI-ready ledger rows.

**QA:**
- Command: adapter tests pass.
- Scenario: mocked 402 challenge results in one successful data response and one spend entry.
- Scenario: provider timeout yields partial-data-safe error object, not process crash.
- Evidence: `.sisyphus/evidence/task-8-direct-mpp.txt`

**Commit:** `feat(mpp): add direct provider payment flow`

### Task 9: Add one LLM synthesis path and deterministic agent loop

**Wave**: 5  
**Depends on**: Tasks 7, 8  
**Blocks**: Tasks 10, 11

**Files:**
- Create `apps/backend/src/agent-engine.ts`
- Create `apps/backend/src/agent-engine.test.ts`
- Create `apps/backend/src/tools/llm.ts`
- Modify `apps/backend/src/tools/definitions.ts`

**Steps:**
1. Write failing tests for a deterministic prompt producing a report from fixture tool results.
2. Implement one LLM path (`Anthropic` or `OpenAI`) with a fallback fake provider for demo mode.
3. Add budget-aware tool execution loop with enhancement reserve logic.
4. Make the default demo run deterministic even if live LLM mode is unavailable.

**Acceptance Criteria:**
- Agent loop can synthesize a report from gathered data.
- Budget exhaustion stops further tool calls and still yields a partial report.
- LLM cost is represented in the same report/audit summary model.

**QA:**
- Command: agent-engine tests pass.
- Scenario: deterministic canonical prompt produces expected report sections.
- Scenario: budget exhaustion path emits partial report plus truthful note.
- Evidence: `.sisyphus/evidence/task-9-agent-loop.txt`

**Commit:** `feat(agent): add deterministic research and synthesis loop`

### Task 10: Build web task creation and live feed UI

**Wave**: 6  
**Depends on**: Tasks 2, 7, 8, 9  
**Blocks**: Task 11

**Files:**
- Create `apps/web/app/layout.tsx`
- Create `apps/web/app/page.tsx`
- Create `apps/web/app/task/[taskId]/page.tsx`
- Create `apps/web/components/TaskForm.tsx`
- Create `apps/web/components/LiveFeed.tsx`
- Create `apps/web/components/ActivityEntry.tsx`
- Create `apps/web/components/SourceCard.tsx`
- Create `apps/web/lib/ws.ts`
- Create `apps/web/lib/tempo.ts`

**Steps:**
1. Write failing component/integration tests for task submission and live feed rendering.
2. Implement the task form with prompt, budget, deadline, source toggles, and enhancement toggles.
3. Implement live feed page subscribed to websocket updates.
4. Add clear fallback status when passkey flow is unavailable and EOA/dev mode is used.

**Acceptance Criteria:**
- User can submit a task request from the UI.
- Live feed reflects backend status changes and spend events.
- Disabled enhancements are visibly disabled and not sent in the task payload.

**QA:**
- Command: frontend test command passes.
- Scenario: task form submit posts expected payload.
- Scenario: live feed renders streamed events in order.
- Evidence: `.sisyphus/evidence/task-10-web-live-feed.txt`

**Commit:** `feat(web): add task creation and live feed experience`

### Task 11: Build results + audit UI with spend consistency checks

**Wave**: 6  
**Depends on**: Tasks 7, 8, 9, 10  
**Blocks**: Task 12

**Files:**
- Create `apps/web/app/task/[taskId]/results/page.tsx`
- Create `apps/web/components/ReportPanel.tsx`
- Create `apps/web/components/AuditPanel.tsx`
- Create `apps/web/components/BudgetChart.tsx`
- Create `apps/web/components/AudioPlayer.tsx` only if shipped in later wave

**Steps:**
1. Write failing tests for results rendering and summary totals.
2. Implement report view, audit list, and summary banner.
3. Reconcile and display premium, direct, and LLM costs in one consistent total.
4. Add refund banner and task completion state.

**Acceptance Criteria:**
- Results page renders report and itemized audit entries.
- Report summary total matches audit total.
- Refund banner appears when `budget > spent`.

**QA:**
- Command: frontend results tests pass.
- Scenario: mixed premium + direct + llm ledger entries produce one correct total.
- Scenario: refund banner shows exact remainder.
- Evidence: `.sisyphus/evidence/task-11-results-audit.txt`

**Commit:** `feat(web): add report and audit results surfaces`

### Task 12: Add one enhancement and finalize demo mode

**Wave**: 7  
**Depends on**: Tasks 5, 9, 10, 11  
**Blocks**: final verification only

**Files:**
- Create `apps/backend/src/tools/cover-image.ts`
- Create `apps/backend/src/tools/cover-image.test.ts`
- Modify `apps/backend/src/tools/executor.ts`
- Modify `apps/web/components/ReportPanel.tsx`
- Create demo prompt fixtures under `apps/backend/src/demo/`

**Steps:**
1. Ship only one enhancement in this wave: cover image is the recommended default.
2. Write failing tests for enhancement-on vs enhancement-off behavior.
3. Add deterministic demo prompt and fixture outputs matching the demo script.
4. Add a one-command smoke path that runs the app in demo mode.

**Acceptance Criteria:**
- Enhancement-off path incurs zero enhancement charges.
- Enhancement-on path produces one visible cover image and one enhancement ledger row.
- Demo mode can produce the full hackathon story without live-provider dependence.

**QA:**
- Command: enhancement tests pass.
- Scenario: same prompt with enhancement disabled produces no enhancement entries.
- Scenario: demo-mode smoke run finishes with report + audit + refund.
- Evidence: `.sisyphus/evidence/task-12-demo-mode.txt`

**Commit:** `feat(demo): add cover-image enhancement and offline-safe demo mode`

### Task 13: Optional polish wave after MVP is green

**Wave**: 7 optional  
**Depends on**: Task 12  
**Blocks**: none

**Files:**
- Extend from existing enhancement/provider files only after MVP evidence exists

**Steps:**
1. Choose exactly one of: passkey hardening, fee sponsorship, Allium integration, audio briefing.
2. Add tests before code.
3. Commit each polish item separately.

**Acceptance Criteria:**
- Optional work does not regress MVP smoke path.

**QA:**
- Re-run full smoke + targeted tests after each optional item.
- Evidence: `.sisyphus/evidence/task-13-polish.txt`

**Commit:** separate commit per optional item

---

## Final Verification Wave

- Validate one live-provider run and one demo-mode run
- Validate total spend matches across backend summary, audit UI, and treasury/direct ledgers
- Validate emergency stop and refund behavior
- Validate disabled enhancement path incurs zero enhancement charges

## Commit Strategy

- Commit 1: workspace + shared constants/types
- Commit 2: treasury contract + tests
- Commit 3: proxy + premium mocks + tests
- Commit 4: backend state machine + fake executor
- Commit 5: real MPP adapters + reconciliation
- Commit 6: frontend flow
- Commit 7: enhancement + demo mode + final QA

## Success Criteria

- A user can create a task with a budget and source selection
- The agent can execute one real direct-MPP query and one premium mock query
- The agent can produce a report and visible spend log
- The app can stop a task and show remaining refund
- The demo still works when live-provider mode is disabled
