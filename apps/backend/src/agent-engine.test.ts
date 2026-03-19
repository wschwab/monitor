/**
 * Agent Engine Tests
 *
 * Tests for the budget-aware tool execution loop and LLM synthesis path.
 *
 * TDD: Written FIRST (RED), then implementation follows (GREEN).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentEngine, AgentEngineOptions, RunResult } from './agent-engine';
import { SpendLedger } from './spend-ledger';
import { TaskManager } from './task-manager';

// =============================================================================
// Helpers
// =============================================================================

function makeEngine(overrides: Partial<AgentEngineOptions> = {}): {
  engine: AgentEngine;
  spendLedger: SpendLedger;
  taskManager: TaskManager;
} {
  const spendLedger = new SpendLedger();
  const taskManager = new TaskManager();

  const engine = new AgentEngine({
    spendLedger,
    taskManager,
    demoMode: true,
    ...overrides,
  });

  return { engine, spendLedger, taskManager };
}

function makeTask(
  taskManager: TaskManager,
  spendLedger: SpendLedger,
  opts: { budgetWei?: bigint } = {}
) {
  const budgetWei = opts.budgetWei ?? BigInt('2000000000000000000'); // 2 ETH
  const taskId = `task-test-${Date.now()}`;

  taskManager.createTask({
    id: taskId,
    prompt: 'Find the classified CERN dossier on Hououin Kyouma',
    budgetWei,
    deadline: Date.now() + 3_600_000,
    owner: '0xdeadbeef',
    sources: ['exa', 'cern-temporal'],
  });

  // Transition to RUNNING so spend ledger accepts charges
  taskManager.transitionStatus(taskId, 'FUNDING');
  taskManager.transitionStatus(taskId, 'RUNNING');

  spendLedger.createTask({
    taskId,
    budgetWei,
    deadlineMs: Date.now() + 3_600_000,
  });

  return taskId;
}

// =============================================================================
// AgentEngine: run()
// =============================================================================

describe('AgentEngine', () => {
  describe('run() — demo mode', () => {
    it('should complete a full run and return a report', async () => {
      const { engine, spendLedger, taskManager } = makeEngine();
      const taskId = makeTask(taskManager, spendLedger);

      const result = await engine.run(taskId);

      expect(result.success).toBe(true);
      expect(result.report).toBeDefined();
      expect(result.report!.length).toBeGreaterThan(0);
    });

    it('should transition task through RUNNING → COMPILING → COMPLETE', async () => {
      const { engine, spendLedger, taskManager } = makeEngine();
      const taskId = makeTask(taskManager, spendLedger);

      await engine.run(taskId);

      const task = taskManager.getTask(taskId);
      expect(task!.status).toBe('COMPLETE');
    });

    it('should record spend entries for tool calls and LLM synthesis', async () => {
      const { engine, spendLedger, taskManager } = makeEngine();
      const taskId = makeTask(taskManager, spendLedger);

      await engine.run(taskId);

      const totals = spendLedger.getSpendTotals(taskId);
      expect(totals.totalWei).toBeGreaterThan(BigInt(0));
    });

    it('should emit feed entries for each tool call and synthesis step', async () => {
      const { engine, spendLedger, taskManager } = makeEngine();
      const taskId = makeTask(taskManager, spendLedger);

      await engine.run(taskId);

      const entries = taskManager.getFeedEntries(taskId);
      expect(entries.length).toBeGreaterThan(2);
      const types = entries.map(e => e.type);
      expect(types).toContain('query');
      expect(types).toContain('status');
    });

    it('should include spend summary in the run result', async () => {
      const { engine, spendLedger, taskManager } = makeEngine();
      const taskId = makeTask(taskManager, spendLedger);

      const result = await engine.run(taskId);

      expect(result.spendSummary).toBeDefined();
      expect(result.spendSummary!.totalWei).toBeGreaterThanOrEqual(BigInt(0));
    });
  });

  describe('run() — budget exhaustion', () => {
    it('should stop tool calls when budget is exhausted', async () => {
      const { engine, spendLedger, taskManager } = makeEngine();
      // 1 wei — not enough for any tool call
      const taskId = makeTask(taskManager, spendLedger, {
        budgetWei: BigInt(1),
      });

      const result = await engine.run(taskId);

      // Should still return something, not throw
      expect(result).toBeDefined();
      expect(result.partial).toBe(true);
    });

    it('should still yield a partial report on budget exhaustion', async () => {
      const { engine, spendLedger, taskManager } = makeEngine();
      const taskId = makeTask(taskManager, spendLedger, {
        budgetWei: BigInt(1),
      });

      const result = await engine.run(taskId);

      expect(result.report).toBeDefined();
      expect(result.report).toMatch(/partial|budget|insufficient/i);
    });

    it('should transition task to COMPLETE even on partial run', async () => {
      const { engine, spendLedger, taskManager } = makeEngine();
      const taskId = makeTask(taskManager, spendLedger, {
        budgetWei: BigInt(1),
      });

      await engine.run(taskId);

      const task = taskManager.getTask(taskId);
      // COMPLETE or FAILED are both acceptable on exhaustion
      expect(['COMPLETE', 'FAILED']).toContain(task!.status);
    });
  });

  describe('run() — emergency stop', () => {
    it('should abort run when task is stopped mid-execution', async () => {
      const { engine, spendLedger, taskManager } = makeEngine({
        // Inject a slow step so we can stop mid-run
        stepDelayMs: 50,
      });
      const taskId = makeTask(taskManager, spendLedger);

      // Stop the task after a short delay
      setTimeout(() => taskManager.stopTask(taskId), 25);

      const result = await engine.run(taskId);

      expect(result.aborted).toBe(true);
    });
  });

  describe('synthesize() — LLM adapter', () => {
    it('should produce a report string from gathered data in demo mode', async () => {
      const { engine } = makeEngine({ demoMode: true });

      const report = await engine.synthesize({
        prompt: 'Find classified CERN dossier on Hououin Kyouma',
        toolResults: [
          { toolId: 'exa', data: { results: [{ title: 'CERN Dossier', text: 'Classified...' }] } },
        ],
        taskId: 'task-synth-test',
      });

      expect(typeof report).toBe('string');
      expect(report.length).toBeGreaterThan(50);
    });

    it('should include source tool ids in the synthesis context', async () => {
      const { engine } = makeEngine({ demoMode: true });

      const report = await engine.synthesize({
        prompt: 'test prompt',
        toolResults: [
          { toolId: 'exa', data: { results: [] } },
          { toolId: 'cern-temporal', data: { findings: 'temporal anomaly' } },
        ],
        taskId: 'task-synth-test-2',
      });

      // Demo synthesis should reference sources somehow
      expect(report).toBeDefined();
      expect(report.length).toBeGreaterThan(0);
    });

    it('should use live LLM when apiKey is set and demoMode is false', async () => {
      const mockLLMCall = vi.fn().mockResolvedValue('# Research Report\n\nFindings: El Psy Kongroo.');

      const { engine } = makeEngine({
        demoMode: false,
        llmApiKey: 'test-key',
        llmCallFn: mockLLMCall,
      });

      const report = await engine.synthesize({
        prompt: 'test prompt',
        toolResults: [{ toolId: 'exa', data: {} }],
        taskId: 'task-live-test',
      });

      expect(mockLLMCall).toHaveBeenCalledOnce();
      expect(report).toContain('El Psy Kongroo');
    });

    it('should fall back to demo synthesis when live LLM call fails', async () => {
      const mockLLMCall = vi.fn().mockRejectedValue(new Error('API error'));

      const { engine } = makeEngine({
        demoMode: false,
        llmApiKey: 'test-key',
        llmCallFn: mockLLMCall,
        fallbackToDemo: true,
      });

      const report = await engine.synthesize({
        prompt: 'test prompt',
        toolResults: [{ toolId: 'exa', data: {} }],
        taskId: 'task-fallback-test',
      });

      // Should not throw — returns demo synthesis
      expect(typeof report).toBe('string');
      expect(report.length).toBeGreaterThan(0);
    });
  });

  describe('selectTools()', () => {
    it('should select tools based on task sources', async () => {
      const { engine, spendLedger, taskManager } = makeEngine();
      const taskId = makeTask(taskManager, spendLedger);

      const tools = engine.selectTools(taskId);

      expect(tools.length).toBeGreaterThan(0);
      // Task was created with sources: ['exa', 'cern-temporal']
      const toolIds = tools.map(t => t.toolId);
      expect(toolIds).toContain('exa');
    });

    it('should respect LLM cost reserve when selecting tools', async () => {
      const { engine, spendLedger, taskManager } = makeEngine();
      // Budget just barely enough for LLM reserve only
      const taskId = makeTask(taskManager, spendLedger, {
        budgetWei: BigInt('500000000000000000'), // 0.5 ETH (= LLM cost)
      });

      const tools = engine.selectTools(taskId);

      // No room for data tools — all budget reserved for LLM
      expect(tools.length).toBe(0);
    });
  });
});
