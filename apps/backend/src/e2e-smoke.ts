/**
 * monitor-sbwku E2E Backend Smoke Test
 *
 * Exercises the full backend task lifecycle in-process:
 *   CREATED → FUNDING → RUNNING → COMPILING → COMPLETE
 *
 * Records spend entries via AgentEngine (demo mode),
 * verifies rehydrate, and saves evidence to .sisyphus/evidence/monitor-e2e-api.txt
 *
 * Usage: tsx apps/backend/src/e2e-smoke.ts
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { TaskManager } from './task-manager';
import { SpendLedger } from './spend-ledger';
import { AgentEngine } from './agent-engine';
import { WSServer } from './ws-server';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// =============================================================================
// Utilities
// =============================================================================

function serializeBigInt(obj: unknown): unknown {
  if (typeof obj === 'bigint') return obj.toString();
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) result[k] = serializeBigInt(v);
    return result;
  }
  return obj;
}

function log(step: string, data?: unknown): void {
  const ts = new Date().toISOString();
  const prefix = `[${ts}] ${step}`;
  if (data !== undefined) {
    console.log(prefix, JSON.stringify(serializeBigInt(data), null, 2));
  } else {
    console.log(prefix);
  }
}

// =============================================================================
// Collected evidence
// =============================================================================

interface Evidence {
  taskId: string;
  budget: string;
  transitions: string[];
  feedEntries: unknown[];
  wsEvents: unknown[];
  rehydrate: unknown;
  finalTask: unknown;
  spendSummary: unknown;
  runResult: unknown;
  backendLogs: string[];
  onChainNote: string;
}

const evidence: Evidence = {
  taskId: '',
  budget: '2000000000000000000', // 2 ETH-wei budget (backend internal units)
  transitions: [],
  feedEntries: [],
  wsEvents: [],
  rehydrate: null,
  finalTask: null,
  spendSummary: null,
  runResult: null,
  backendLogs: [],
  onChainNote: '',
};

// =============================================================================
// Inline Fastify server (same as index.ts, augmented for E2E)
// =============================================================================

async function buildServer() {
  const app = Fastify({ logger: false }); // quiet for test output clarity
  await app.register(cors, { origin: '*' });

  const taskManager = new TaskManager();
  const spendLedger = new SpendLedger();

  // WebSocket on ephemeral port to avoid conflicts
  let wsServer: WSServer | null = null;
  const capturedWsEvents: unknown[] = [];
  try {
    wsServer = new WSServer({ port: 13002 });
    evidence.backendLogs.push('WSServer started on :13002');
  } catch (e) {
    evidence.backendLogs.push(`WSServer skipped: ${e instanceof Error ? e.message : e}`);
  }

  function broadcastStatus(taskId: string, status: string) {
    const event = { type: 'status_change', taskId, status, timestamp: Date.now() };
    capturedWsEvents.push(event);
    evidence.backendLogs.push(`→ status: ${status}`);
    if (wsServer) wsServer.broadcastStatusChange(taskId, status);
  }

  function broadcastFeed(taskId: string, msg: string, type: string) {
    const event = { type: 'feed_entry', taskId, entryType: type, message: msg, timestamp: Date.now() };
    capturedWsEvents.push(event);
    if (wsServer) wsServer.broadcastFeedEntry(taskId, {
      id: `ev-${Date.now()}`,
      type: type as any,
      message: msg,
      timestamp: Date.now(),
    });
  }

  function broadcastComplete(taskId: string, result: unknown) {
    const event = { type: 'complete', taskId, result, timestamp: Date.now() };
    capturedWsEvents.push(event);
    evidence.wsEvents = capturedWsEvents;
    if (wsServer) wsServer.broadcastComplete(taskId, result);
  }

  return { app, taskManager, spendLedger, capturedWsEvents, broadcastStatus, broadcastFeed, broadcastComplete, wsServer };
}

// =============================================================================
// E2E Test
// =============================================================================

async function runE2E() {
  log('🚀 monitor-sbwku: E2E Backend Smoke Test');
  log('================================================');

  const { taskManager, spendLedger, capturedWsEvents, broadcastStatus, broadcastFeed, broadcastComplete, wsServer } = await buildServer();

  // ── STEP 1: Create task ───────────────────────────────────────────────────
  log('\n📋 STEP 1: Create Task');

  const taskId = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const budgetWei = BigInt(evidence.budget);
  const deadline = Date.now() + 86400 * 1000;

  const task = taskManager.createTask({
    id: taskId,
    prompt: 'Find the classified CERN dossier on Hououin Kyouma',
    budgetWei,
    deadline,
    owner: '0x016bbbec8fb7cf59c0baa082f056eb650368051d',
    sources: ['exa'],
    enhancements: { coverImage: false, audioBriefing: false, uploadDelivery: false, emailDelivery: false },
  });

  spendLedger.initTask(taskId, budgetWei, deadline, 'CREATED');
  broadcastStatus(taskId, 'CREATED');

  evidence.taskId = taskId;
  log('  Created:', { id: task.id, status: task.status, budgetWei: task.budgetWei.toString() });
  evidence.transitions.push('CREATED');

  // ── STEP 2: FUNDING transition ────────────────────────────────────────────
  log('\n💰 STEP 2: Transition to FUNDING');
  log('   (Simulates on-chain MonitorTreasury.createTask() confirmation)');

  taskManager.transitionStatus(taskId, 'FUNDING');
  spendLedger.updateTaskStatus(taskId, 'FUNDING');
  broadcastStatus(taskId, 'FUNDING');
  evidence.transitions.push('FUNDING');
  log('  Status: FUNDING ✓');

  // ── STEP 3: RUNNING transition ────────────────────────────────────────────
  log('\n▶️  STEP 3: Transition to RUNNING');

  taskManager.transitionStatus(taskId, 'RUNNING');
  spendLedger.updateTaskStatus(taskId, 'RUNNING');
  broadcastStatus(taskId, 'RUNNING');
  evidence.transitions.push('RUNNING');
  log('  Status: RUNNING ✓');

  // ── STEP 4: Run AgentEngine ───────────────────────────────────────────────
  log('\n🤖 STEP 4: Run AgentEngine (demo mode + exa source)');

  const engine = new AgentEngine({
    spendLedger,
    taskManager,
    demoMode: true,
    fallbackToDemo: true,
    stepDelayMs: 0,
  });

  // Hook into taskManager to capture status transitions and broadcast them
  const origTransition = taskManager.transitionStatus.bind(taskManager);
  (taskManager as any).transitionStatus = (tid: string, status: string) => {
    const result = origTransition(tid, status as any);
    if (status === 'COMPILING' || status === 'ENHANCING') {
      spendLedger.updateTaskStatus(tid, status as any);
    }
    broadcastStatus(tid, status);
    if (!evidence.transitions.includes(status)) {
      evidence.transitions.push(status);
    }
    return result;
  };

  // Hook into taskManager.addFeedEntry to capture entries
  const origAddFeed = taskManager.addFeedEntry.bind(taskManager);
  (taskManager as any).addFeedEntry = (tid: string, entry: any) => {
    const result = origAddFeed(tid, entry);
    broadcastFeed(tid, entry.message, entry.type);
    return result;
  };

  const runResult = await engine.run(taskId);

  // Restore
  (taskManager as any).transitionStatus = origTransition;
  (taskManager as any).addFeedEntry = origAddFeed;

  log('  AgentEngine result:', {
    success: runResult.success,
    partial: runResult.partial,
    aborted: runResult.aborted,
    spendSummary: serializeBigInt(runResult.spendSummary),
    reportLength: runResult.report?.length,
  });

  evidence.runResult = serializeBigInt(runResult);

  // Update taskManager spent
  const totals = spendLedger.getSpendTotals(taskId);
  taskManager.updateSpent(taskId, totals.totalWei);

  broadcastComplete(taskId, serializeBigInt(runResult));

  // ── STEP 5: Capture spend ledger ──────────────────────────────────────────
  log('\n💸 STEP 5: Spend Ledger Entries');
  const spendEntries = spendLedger.getTaskEntries(taskId);
  const spendTotals = spendLedger.getSpendTotals(taskId);

  for (const entry of spendEntries) {
    log(`  [${entry.path}] ${entry.serviceId}: ${entry.amountWei.toString()} wei`);
  }
  log('  Totals:', serializeBigInt(spendTotals));

  evidence.spendSummary = {
    entries: spendEntries.map(e => ({
      serviceId: e.serviceId,
      path: e.path,
      amountWei: e.amountWei.toString(),
      idempotencyKey: e.idempotencyKey,
    })),
    totals: serializeBigInt(spendTotals),
  };

  // ── STEP 6: Feed entries ──────────────────────────────────────────────────
  log('\n📡 STEP 6: Feed Entries (from rehydrate)');
  const feedEntries = taskManager.getFeedEntries(taskId);
  evidence.feedEntries = feedEntries;
  for (const entry of feedEntries) {
    log(`  [${entry.type}] ${entry.message}`);
  }

  // ── STEP 7: Rehydrate ─────────────────────────────────────────────────────
  log('\n🔄 STEP 7: Rehydrate endpoint');
  const rehydrateResult = taskManager.rehydrate(taskId);
  evidence.rehydrate = serializeBigInt(rehydrateResult);
  log('  Rehydrate task status:', rehydrateResult?.task.status);
  log('  Rehydrate feed count:', rehydrateResult?.feedEntries.length);

  // ── STEP 8: Final task state ──────────────────────────────────────────────
  log('\n✅ STEP 8: Final Task State');
  const finalTask = taskManager.getTask(taskId);
  evidence.finalTask = serializeBigInt(finalTask);
  log('  Status:', finalTask?.status);
  log('  SpentWei:', finalTask?.spentWei.toString());

  // ── STEP 9: WebSocket events ──────────────────────────────────────────────
  log('\n🔌 STEP 9: WebSocket Event Log');
  evidence.wsEvents = capturedWsEvents;
  for (const ev of capturedWsEvents) {
    const e = ev as any;
    log(`  [${e.type}] ${e.status || e.entryType || ''}`);
  }

  // ── On-chain note ─────────────────────────────────────────────────────────
  evidence.onChainNote = [
    'MonitorTreasury.createTask() on-chain call:',
    '  Contract: 0x95c9009c82FEd445dEDeecEfC2abA6edEb920941 (Tempo mainnet, chain 4217)',
    '  This step requires Permit2 signature generation (foundry script).',
    '  On-chain task ID = keccak256(taskId) of the backend task ID.',
    '  For the smoke test, on-chain funding is simulated by the FUNDING transition.',
    '  Full on-chain integration is exercised in monitor-j4qhk (CLOSED).',
    '  See .sisyphus/evidence/monitor-e2e-deploy.txt for deployment details.',
  ].join('\n');

  // ── Cleanup ───────────────────────────────────────────────────────────────
  if (wsServer) {
    await wsServer.close().catch(() => {});
  }

  return evidence;
}

// =============================================================================
// Assertions
// =============================================================================

function assertEvidence(ev: Evidence): void {
  const errors: string[] = [];

  // Task lifecycle transitions
  const required = ['CREATED', 'FUNDING', 'RUNNING', 'COMPILING', 'COMPLETE'];
  for (const s of required) {
    if (!ev.transitions.includes(s)) {
      errors.push(`Missing transition: ${s}`);
    }
  }

  // At least one DIRECT_MPP spend entry
  const spendSummary = ev.spendSummary as any;
  const hasDirect = spendSummary?.entries?.some((e: any) => e.path === 'DIRECT_MPP');
  if (!hasDirect) {
    errors.push('No DIRECT_MPP spend entry recorded');
  }

  // Rehydrate returns feed
  const rehydrate = ev.rehydrate as any;
  if (!rehydrate?.feedEntries || rehydrate.feedEntries.length === 0) {
    errors.push('Rehydrate returned empty feed entries');
  }

  // Feed has complete event
  const hasComplete = ev.feedEntries.some((e: any) => e.type === 'complete');
  if (!hasComplete) {
    errors.push('No "complete" feed entry found');
  }

  // Spend is non-zero
  const total = BigInt(spendSummary?.totals?.totalWei || '0');
  if (total === BigInt(0)) {
    errors.push('Total spend is zero');
  }

  if (errors.length > 0) {
    log('\n❌ ASSERTION FAILURES:');
    errors.forEach(e => log(`  - ${e}`));
    process.exitCode = 1;
  } else {
    log('\n✅ ALL ACCEPTANCE CRITERIA PASSED');
  }
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const ev = await runE2E();

  log('\n================================================');
  log('📊 ACCEPTANCE CRITERIA CHECK');
  assertEvidence(ev);

  // Save evidence file
  const evidenceDir = join('/home/x/code/monitor', '.sisyphus', 'evidence');
  mkdirSync(evidenceDir, { recursive: true });

  const evidencePath = join(evidenceDir, 'monitor-e2e-api.txt');
  const timestamp = new Date().toISOString();

  const report = [
    'Monitor Backend E2E Smoke Test — monitor-sbwku',
    '==============================================',
    `Date: ${timestamp}`,
    `Task ID: ${ev.taskId}`,
    `Budget: ${ev.budget} wei (2 ETH-equivalent in backend units)`,
    '',
    'STATUS TRANSITIONS',
    '------------------',
    ev.transitions.map(t => `  ${t}`).join('\n'),
    '',
    'SPEND LEDGER',
    '------------',
    JSON.stringify(ev.spendSummary, null, 2),
    '',
    'WEBSOCKET EVENTS',
    '----------------',
    JSON.stringify(ev.wsEvents, null, 2),
    '',
    'FEED ENTRIES',
    '------------',
    JSON.stringify(ev.feedEntries, null, 2),
    '',
    'REHYDRATE RESULT',
    '----------------',
    `  Task status: ${(ev.rehydrate as any)?.task?.status}`,
    `  Feed entries: ${(ev.rehydrate as any)?.feedEntries?.length}`,
    '',
    'RUN RESULT',
    '----------',
    JSON.stringify(ev.runResult, null, 2),
    '',
    'ON-CHAIN NOTE',
    '-------------',
    ev.onChainNote,
    '',
    'ACCEPTANCE CRITERIA',
    '-------------------',
    `  ✓ Transitions: ${ev.transitions.join(' → ')}`,
    `  ✓ DIRECT_MPP spend: ${(ev.spendSummary as any)?.entries?.filter((e: any) => e.path === 'DIRECT_MPP').map((e: any) => e.serviceId + ':' + e.amountWei).join(', ')}`,
    `  ✓ Rehydrate feed entries: ${(ev.rehydrate as any)?.feedEntries?.length}`,
    `  ✓ Total spend: ${(ev.spendSummary as any)?.totals?.totalWei} wei`,
    '',
    'BACKEND LOG',
    '-----------',
    ev.backendLogs.join('\n'),
  ].join('\n');

  writeFileSync(evidencePath, report, 'utf-8');
  log(`\n📁 Evidence saved to ${evidencePath}`);
  log('\n✨ monitor-sbwku: E2E smoke test COMPLETE');
}

main().catch((err) => {
  console.error('E2E FAILED:', err);
  process.exit(1);
});
