---
task: monitor-uqo6w
agent: Sisyphus
project: monitor
completed: 2026-03-19
files:
  - apps/web/app/page.tsx
  - apps/web/app/layout.tsx
  - apps/web/app/task/[taskId]/page.tsx
  - apps/web/components/TaskForm.tsx
  - apps/web/components/TaskForm.test.tsx
  - apps/web/components/LiveFeed.tsx
  - apps/web/components/LiveFeed.test.tsx
  - apps/web/components/ActivityEntry.tsx
  - apps/web/lib/api.ts
  - apps/web/lib/ws.ts
  - apps/web/vitest.config.ts
  - apps/web/vitest.setup.ts
tags:
  - frontend
  - react
  - websocket
  - task-form
  - live-feed
  - tdd
labels:
  - wave-6
  - tdd-compliant
priority: P3
type: task
---

# Build Web Task Creation and Live Feed UI

## Summary

Built the full task creation + live feed UI in Next.js. TaskForm with
source provider toggles, LiveFeed with real-time WebSocket updates,
ActivityEntry with per-type icons. Home page → form submission → live
feed page. 23 component tests (TDD RED→GREEN). 200 total tests.

## Key Files

- `apps/web/app/page.tsx` — Home: TaskForm wired to POST /tasks, redirects to /task/:id
- `apps/web/app/task/[taskId]/page.tsx` — Live feed: rehydrates then subscribes to WS
- `apps/web/components/TaskForm.tsx` — Form with validation, source checkboxes, loading state
- `apps/web/components/LiveFeed.tsx` — Feed list, status bar, stop button
- `apps/web/components/ActivityEntry.tsx` — Per-type icons/colours (query/spend/complete...)
- `apps/web/lib/api.ts` — createTask, rehydrateTask, stopTask fetch wrappers
- `apps/web/lib/ws.ts` — WSClient connect/disconnect lifecycle

## Decisions

### No UI framework
Plain React + inline styles. Avoids Tailwind/MUI setup complexity for MVP.
Consistent dark theme (#080808 bg, #0f172a card) throughout.

### Testing setup
`@vitejs/plugin-react` + jsdom environment. `@testing-library/react` + userEvent.
Separate `vitest.config.ts` in the web app (not root) to keep react plugin scoped.

### Empty state copy
"stopped" and "failed" were both in the status bar AND empty state text, causing
`getByText` to match multiple elements. Fixed by using non-overlapping copy in
empty state: "The run was cancelled before any activity." / "An error occurred..."

### WSClient lifecycle
React `useEffect` returns the disconnect fn as cleanup. Terminal statuses
(COMPLETE/FAILED/STOPPED) skip WebSocket connection entirely (no point subscribing).

## Next Steps

Task monitor-x07tq: Build results and audit UI
- ReportPanel: renders markdown report
- AuditPanel: itemized spend table (TREASURY/DIRECT_MPP/LLM rows)
- BudgetChart: visual spend breakdown
- Refund banner when budget > spent
- Depends on this task (monitor-uqo6w) ← now closed
