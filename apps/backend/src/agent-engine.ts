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
import { CoverImageResult, generateCoverImage } from './tools/cover-image';
import { PremiumExecutor, PremiumProvider } from './premium-executor';

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

interface ToolSpendEntry {
  id: string;
  amountWei: bigint;
  path: 'TREASURY' | 'DIRECT_MPP' | 'LLM';
  serviceId: string;
  memo: string;
  queryIndex: number;
}

interface ToolExecutionResult extends ToolResultData {
  spendEntry?: ToolSpendEntry;
}

export interface RunResult {
  success: boolean;
  report?: string;
  coverImage?: CoverImageResult;
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
const COVER_IMAGE_COST_WEI = getToolCost('cover-image');
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
  private premiumExecutor: PremiumExecutor;

  constructor(options: AgentEngineOptions) {
    this.spendLedger = options.spendLedger;
    this.taskManager = options.taskManager;
    this.demoMode = options.demoMode ?? true;
    this.fallbackToDemo = options.fallbackToDemo ?? true;
    this.stepDelayMs = options.stepDelayMs ?? 0;
    this.exaApiKey = options.exaApiKey ?? process.env['EXA_API_KEY'] ?? '';
    this.premiumExecutor = new PremiumExecutor({
      spendLedger: options.spendLedger,
      treasuryAddress:
        process.env['TREASURY_ADDRESS'] || '0x0000000000000000000000000000000000000000',
    });

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
      const enhancementReserve = task.enhancements.coverImage ? COVER_IMAGE_COST_WEI : BigInt(0);
      if (remaining < toolCost + LLM_SYNTHESIS_COST_WEI + enhancementReserve) {
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
        toolResults.push({ toolId: result.toolId, data: result.data });

        if (result.spendEntry) {
          this.taskManager.addFeedEntry(taskId, {
            type: 'spend',
            message: `Spent ${this.formatEth(result.spendEntry.amountWei)} on ${result.spendEntry.serviceId}`,
            timestamp: Date.now(),
            amountWei: result.spendEntry.amountWei,
            serviceId: result.spendEntry.serviceId,
            payload: {
              path: result.spendEntry.path,
              memo: result.spendEntry.memo,
              queryIndex: result.spendEntry.queryIndex,
            },
          });
        }
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
    let coverImage: CoverImageResult | undefined;

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

      const llmSpend = this.spendLedger.getTaskEntries(taskId).at(-1);
      if (llmSpend?.serviceId === 'llm-synthesize') {
        this.taskManager.addFeedEntry(taskId, {
          type: 'spend',
          message: `Spent ${this.formatEth(llmSpend.amountWei)} on ${llmSpend.serviceId}`,
          timestamp: llmSpend.timestamp,
          amountWei: llmSpend.amountWei,
          serviceId: llmSpend.serviceId,
          payload: {
            path: llmSpend.path,
            memo: llmSpend.memo,
            queryIndex: llmSpend.queryIndex,
          },
        });
      }

      report = await this.synthesize({
        prompt: task.prompt,
        toolResults,
        taskId,
      });
    }

    if (task.enhancements.coverImage) {
      if (this.spendLedger.getRemainingBudget(taskId) >= COVER_IMAGE_COST_WEI) {
        try {
          this.taskManager.transitionStatus(taskId, 'ENHANCING');
        } catch {
          // may already be terminal
        }

        this.taskManager.addFeedEntry(taskId, {
          type: 'enhancement',
          message: 'Generating cover image...',
          timestamp: Date.now(),
        });

        coverImage = generateCoverImage({
          prompt: task.prompt,
          report,
          taskId,
        });

        const enhancementSpend = this.spendLedger.recordSpend({
          taskId,
          serviceId: 'cover-image',
          amountWei: COVER_IMAGE_COST_WEI,
          path: 'DIRECT_MPP',
          idempotencyKey: `cover-image-${taskId}-${Date.now()}`,
        });

        if (enhancementSpend.entry) {
          this.taskManager.addFeedEntry(taskId, {
            type: 'spend',
            message: `Spent ${this.formatEth(enhancementSpend.entry.amountWei)} on ${enhancementSpend.entry.serviceId}`,
            timestamp: enhancementSpend.entry.timestamp,
            amountWei: enhancementSpend.entry.amountWei,
            serviceId: enhancementSpend.entry.serviceId,
            payload: {
              path: enhancementSpend.entry.path,
              memo: enhancementSpend.entry.memo,
              queryIndex: enhancementSpend.entry.queryIndex,
            },
          });
        }

        this.taskManager.addFeedEntry(taskId, {
          type: 'enhancement',
          message: 'Cover image ready',
          timestamp: Date.now(),
          payload: { coverImage },
        });
      } else {
        this.taskManager.addFeedEntry(taskId, {
          type: 'enhancement',
          message: 'Skipped cover image because the remaining budget was too low',
          timestamp: Date.now(),
        });
      }
    }

    // ── Finalize ─────────────────────────────────────────────────────────────
    try {
      this.taskManager.transitionStatus(taskId, 'COMPLETE');
    } catch {
      // may already be terminal
    }

    const totals = this.spendLedger.getSpendTotals(taskId);
    const entries = this.spendLedger.getTaskEntries(taskId);

    this.taskManager.addFeedEntry(taskId, {
      type: 'complete',
      message: partial ? 'Partial report ready (budget exhausted)' : 'Report complete',
      timestamp: Date.now(),
      payload: {
        report,
        partial,
        coverImage,
        spendSummary: totals,
      },
    });

    return {
      success: true,
      report,
      coverImage,
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
    const enhancementReserve = task.enhancements.coverImage ? COVER_IMAGE_COST_WEI : BigInt(0);
    // Must keep enough for LLM synthesis and requested cover image.
    const available = remaining - LLM_SYNTHESIS_COST_WEI - enhancementReserve;
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
  ): Promise<ToolExecutionResult | null> {
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
          return {
            toolId: 'exa',
            data: result.data,
            spendEntry: result.spendEntry
              ? {
                  ...result.spendEntry,
                  memo: result.spendEntry.memo,
                  queryIndex: result.spendEntry.queryIndex,
                }
              : undefined,
          };
        }
        return null;
      }

      if (plan.toolId === 'cern-temporal' || plan.toolId === 'cia-declassified') {
        const result = await this.premiumExecutor.fetchPremiumData({
          taskId,
          provider: plan.toolId as PremiumProvider,
          query: (plan.parameters.query as string) || task.prompt,
        });

        if (result.success) {
          return {
            toolId: plan.toolId,
            data: result.data,
            spendEntry: result.spendEntry
              ? {
                  ...result.spendEntry,
                  memo: result.spendEntry.memo,
                  queryIndex: result.spendEntry.queryIndex,
                }
              : undefined,
          };
        }
        return null;
      }

      // Generic demo stub for other tools
      if (this.demoMode) {
        const cost = getToolCost(plan.toolId);
        let spendEntry: ToolSpendEntry | undefined;

        if (cost > BigInt(0)) {
          const spendResult = this.spendLedger.recordSpend({
            taskId,
            serviceId: plan.toolId,
            amountWei: cost,
            path: plan.toolId === 'cern-temporal' || plan.toolId === 'cia-declassified'
              ? 'TREASURY'
              : 'DIRECT_MPP',
            idempotencyKey: `${plan.toolId}-${taskId}-${Date.now()}`,
          });

          if (spendResult.entry) {
            spendEntry = {
              id: spendResult.entry.id,
              amountWei: spendResult.entry.amountWei,
              path: spendResult.entry.path,
              serviceId: spendResult.entry.serviceId,
              memo: spendResult.entry.memo,
              queryIndex: spendResult.entry.queryIndex,
            };
          }
        }

        return {
          toolId: plan.toolId,
          data: { result: `Demo data from ${plan.toolId}`, query: plan.parameters.query },
          spendEntry,
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

  private formatEth(wei: bigint): string {
    return `${(Number(wei) / 1e18).toFixed(4)} USDC`;
  }
}
