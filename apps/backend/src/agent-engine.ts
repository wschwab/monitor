/**
 * Agent Engine
 *
 * Budget-aware tool execution loop with LLM synthesis.
 * Runs tools sequentially, enforces budget + stop checks,
 * synthesizes a report, and transitions task state.
 */

import { SpendLedger } from './spend-ledger';
import { TaskManager } from './task-manager';
import { LLMAdapter, LLMCallFn, SynthesisRequest, ToolResultData } from './tools/llm';
import { ExaAdapter } from './tools/exa';
import { getToolCost } from './tools/definitions';

// =============================================================================
// Types
// =============================================================================

export interface AgentEngineOptions {
  spendLedger: SpendLedger;
  taskManager: TaskManager;
  demoMode?: boolean;
  fallbackToDemo?: boolean;
  llmApiKey?: string;
  llmCallFn?: LLMCallFn;
  exaApiKey?: string;
  stepDelayMs?: number;
}

export interface ToolPlan {
  toolId: string;
  parameters: Record<string, unknown>;
}

export interface SpendSummary {
  totalWei: bigint;
  byPath: Record<string, bigint>;
  entryCount: number;
}

export interface RunResult {
  success: boolean;
  report?: string;
  partial?: boolean;
  aborted?: boolean;
  spendSummary?: SpendSummary;
  error?: string;
}

export interface SynthesizeOptions {
  prompt: string;
  toolResults: ToolResultData[];
  taskId: string;
}

// =============================================================================
// Cost Constants
// =============================================================================

const LLM_SYNTHESIS_COST_WEI = BigInt('500000000000000000'); // 0.5 ETH reserve
const PARTIAL_REPORT_BUDGET_MSG =
  '> **Note:** This is a partial report. The task budget was insufficient to complete all planned research steps.';

// =============================================================================
// Agent Engine
// =============================================================================

export class AgentEngine {
  private spendLedger: SpendLedger;
  private taskManager: TaskManager;
  private demoMode: boolean;
  private fallbackToDemo: boolean;
  private llm: LLMAdapter;
  private stepDelayMs: number;
  private exaApiKey: string;

  constructor(options: AgentEngineOptions) {
    this.spendLedger = options.spendLedger;
    this.taskManager = options.taskManager;
    this.demoMode = options.demoMode ?? true;
    this.fallbackToDemo = options.fallbackToDemo ?? true;
    this.stepDelayMs = options.stepDelayMs ?? 0;
    this.exaApiKey = options.exaApiKey ?? process.env['EXA_API_KEY'] ?? '';

    this.llm = new LLMAdapter({
      apiKey: options.llmApiKey,
      demoMode: this.demoMode,
      fallbackToDemo: this.fallbackToDemo,
      llmCallFn: options.llmCallFn,
    });
  }

  // ===========================================================================
  // Public: run()
  // ===========================================================================

  /**
   * Execute the full agent loop for a task:
   *   1. Select tools based on task sources + budget
   *   2. Run each tool, recording spend + feed entries
   *   3. Check stop / budget after each step
   *   4. Synthesize report via LLM
   *   5. Transition task to COMPLETE (or FAILED)
   */
  async run(taskId: string): Promise<RunResult> {
    const task = this.taskManager.getTask(taskId);
    if (!task) {
      return { success: false, error: 'TASK_NOT_FOUND' };
    }

    const toolPlans = this.selectTools(taskId);
    const toolResults: ToolResultData[] = [];
    // If task has sources but none are affordable (LLM reserve ate all budget),
    // the run is already partial before it begins.
    let partial = task.sources.length > 0 && toolPlans.length === 0;

    // ── Tool execution loop ──────────────────────────────────────────────────
    for (const plan of toolPlans) {
      // Stop check
      const current = this.taskManager.getTask(taskId);
      if (!current || current.status === 'STOPPED') {
        return { success: false, aborted: true, report: undefined };
      }

      // Budget check (reserve LLM cost)
      const remaining = this.spendLedger.getRemainingBudget(taskId);
      const toolCost = getToolCost(plan.toolId);
      if (remaining < toolCost + LLM_SYNTHESIS_COST_WEI) {
        partial = true;
        break;
      }

      // Add feed entry before calling
      this.taskManager.addFeedEntry(taskId, {
        type: 'query',
        message: `Querying ${plan.toolId}...`,
        timestamp: Date.now(),
      });

      // Execute tool
      const result = await this.executeTool(taskId, plan);
      if (result !== null) {
        toolResults.push(result);
      }

      if (this.stepDelayMs > 0) {
        await this.delay(this.stepDelayMs);
      }
    }

    // Stop check after loop
    const afterLoop = this.taskManager.getTask(taskId);
    if (!afterLoop || afterLoop.status === 'STOPPED') {
      return { success: false, aborted: true };
    }

    // ── Synthesis ────────────────────────────────────────────────────────────
    try {
      this.taskManager.transitionStatus(taskId, 'COMPILING');
    } catch {
      // already in a terminal state
    }

    this.taskManager.addFeedEntry(taskId, {
      type: 'reasoning',
      message: 'Synthesizing report...',
      timestamp: Date.now(),
    });

    let report: string;

    if (partial || toolResults.length === 0) {
      // Insufficient budget for a full run — produce partial report
      report = `${PARTIAL_REPORT_BUDGET_MSG}\n\n`;
      if (toolResults.length > 0) {
        report += await this.synthesize({
          prompt: task.prompt,
          toolResults,
          taskId,
        });
      } else {
        report += `*No data could be gathered within the available budget.*\n\n` +
          `Original research objective: "${task.prompt}"`;
      }
    } else {
      // Record LLM spend
      const idempotencyKey = `llm-${taskId}-${Date.now()}`;
      this.spendLedger.recordSpend({
        taskId,
        serviceId: 'llm-synthesize',
        amountWei: LLM_SYNTHESIS_COST_WEI,
        path: 'LLM',
        idempotencyKey,
      });

      report = await this.synthesize({
        prompt: task.prompt,
        toolResults,
        taskId,
      });
    }

    // ── Finalize ─────────────────────────────────────────────────────────────
    try {
      this.taskManager.transitionStatus(taskId, 'COMPLETE');
    } catch {
      // may already be terminal
    }

    this.taskManager.addFeedEntry(taskId, {
      type: 'complete',
      message: partial ? 'Partial report ready (budget exhausted)' : 'Report complete',
      timestamp: Date.now(),
    });

    const totals = this.spendLedger.getSpendTotals(taskId);
    const entries = this.spendLedger.getTaskEntries(taskId);

    return {
      success: true,
      report,
      partial,
      spendSummary: {
        totalWei: totals.totalWei,
        byPath: Object.fromEntries(
          Object.entries(totals.byPath).map(([k, v]) => [k, v])
        ),
        entryCount: entries.length,
      },
    };
  }

  // ===========================================================================
  // Public: synthesize()
  // ===========================================================================

  async synthesize(opts: SynthesizeOptions): Promise<string> {
    return this.llm.synthesize({
      prompt: opts.prompt,
      toolResults: opts.toolResults,
      taskId: opts.taskId,
    });
  }

  // ===========================================================================
  // Public: selectTools()
  // ===========================================================================

  /**
   * Select and plan tool calls for a task based on its sources and remaining budget.
   * Always reserves LLM_SYNTHESIS_COST_WEI before allocating tool slots.
   */
  selectTools(taskId: string): ToolPlan[] {
    const task = this.taskManager.getTask(taskId);
    if (!task) return [];

    const remaining = this.spendLedger.getRemainingBudget(taskId);
    // Must keep enough for LLM synthesis
    const available = remaining - LLM_SYNTHESIS_COST_WEI;
    if (available <= BigInt(0)) return [];

    const plans: ToolPlan[] = [];
    let budgetLeft = available;

    for (const source of task.sources) {
      const cost = getToolCost(source);
      if (cost > BigInt(0) && budgetLeft >= cost) {
        plans.push({
          toolId: source,
          parameters: { query: task.prompt },
        });
        budgetLeft -= cost;
      } else if (cost === BigInt(0)) {
        // Free tool — always include
        plans.push({ toolId: source, parameters: { query: task.prompt } });
      }
    }

    return plans;
  }

  // ===========================================================================
  // Private
  // ===========================================================================

  private async executeTool(
    taskId: string,
    plan: ToolPlan
  ): Promise<ToolResultData | null> {
    const task = this.taskManager.getTask(taskId);
    if (!task) return null;

    try {
      if (plan.toolId === 'exa') {
        const exaAdapter = new ExaAdapter({
          spendLedger: this.spendLedger,
          apiKey: this.exaApiKey,
          demoMode: this.demoMode,
          fallbackToDemo: this.fallbackToDemo,
        });

        const result = await exaAdapter.search({
          taskId,
          query: (plan.parameters.query as string) || task.prompt,
          idempotencyKey: `exa-${taskId}-${Date.now()}`,
        });

        if (result.success) {
          return { toolId: 'exa', data: result.data };
        }
        return null;
      }

      // Generic demo stub for other tools
      if (this.demoMode) {
        const cost = getToolCost(plan.toolId);
        if (cost > BigInt(0)) {
          this.spendLedger.recordSpend({
            taskId,
            serviceId: plan.toolId,
            amountWei: cost,
            path: plan.toolId === 'cern-temporal' || plan.toolId === 'cia-declassified'
              ? 'TREASURY'
              : 'DIRECT_MPP',
            idempotencyKey: `${plan.toolId}-${taskId}-${Date.now()}`,
          });
        }
        return {
          toolId: plan.toolId,
          data: { result: `Demo data from ${plan.toolId}`, query: plan.parameters.query },
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
