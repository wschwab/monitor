/**
 * Spend Ledger
 *
 * In-memory ledger for tracking spend across all payment paths (TREASURY, DIRECT_MPP, LLM).
 * Provides budget/deadline enforcement, idempotency, and spend aggregation.
 */

import { SpendEntry, SpendPath, TaskStatus, VALID_TRANSITIONS } from '@monitor/shared';

// =============================================================================
// Types
// =============================================================================

export interface SpendLedgerEntry {
  id: string;
  taskId: string;
  serviceId: string;
  queryIndex: number;
  amountWei: bigint;
  timestamp: number;
  memo: string;
  path: SpendPath;
  idempotencyKey: string;
}

export interface TaskRecord {
  id: string;
  budgetWei: bigint;
  spentWei: bigint;
  deadlineMs: number;
  status: TaskStatus;
  entries: SpendLedgerEntry[];
}

export interface SpendRequest {
  taskId: string;
  serviceId: string;
  amountWei: bigint;
  path: SpendPath;
  idempotencyKey: string;
  memo?: string;
}

export interface SpendResult {
  success: boolean;
  error?: string;
  spentWei: bigint;
  entry?: SpendLedgerEntry;
}

export interface SpendTotals {
  totalWei: bigint;
  byPath: Record<SpendPath, bigint>;
}

// =============================================================================
// Active Status Set
// =============================================================================

/**
 * Task statuses that allow spend recording.
 */
const ACTIVE_STATUSES: TaskStatus[] = ['FUNDING', 'RUNNING', 'COMPILING', 'ENHANCING'];

// =============================================================================
// SpendLedger Class
// =============================================================================

export class SpendLedger {
  private tasks: Map<string, TaskRecord> = new Map();
  private idempotencyKeys: Map<string, SpendLedgerEntry> = new Map();

  /**
   * Initialize a task with budget and deadline.
   */
  initTask(taskId: string, budgetWei: bigint, deadlineMs: number, status: TaskStatus): void {
    this.tasks.set(taskId, {
      id: taskId,
      budgetWei,
      spentWei: BigInt(0),
      deadlineMs,
      status,
      entries: [],
    });
  }

  /**
   * Record a spend entry with budget/deadline/status enforcement.
   */
  recordSpend(request: SpendRequest): SpendResult {
    const task = this.tasks.get(request.taskId);
    
    // Task must exist
    if (!task) {
      return {
        success: false,
        error: 'TASK_NOT_FOUND',
        spentWei: BigInt(0),
      };
    }

    // Check idempotency key (must be unique per task)
    const fullIdempotencyKey = `${request.taskId}:${request.idempotencyKey}`;
    const existingEntry = this.idempotencyKeys.get(fullIdempotencyKey);
    if (existingEntry) {
      return {
        success: false,
        error: 'DUPLICATE_IDEMPOTENCY_KEY',
        spentWei: task.spentWei,
      };
    }

    // Check task status (must be active)
    if (!ACTIVE_STATUSES.includes(task.status)) {
      return {
        success: false,
        error: 'TASK_NOT_ACTIVE',
        spentWei: task.spentWei,
      };
    }

    // Check deadline (must not have passed)
    if (Date.now() > task.deadlineMs) {
      return {
        success: false,
        error: 'DEADLINE_PASSED',
        spentWei: task.spentWei,
      };
    }

    // Check budget (must not exceed)
    const newTotal = task.spentWei + request.amountWei;
    if (newTotal > task.budgetWei) {
      return {
        success: false,
        error: 'BUDGET_EXCEEDED',
        spentWei: task.spentWei,
      };
    }

    // Create entry
    const entry: SpendLedgerEntry = {
      id: `spend-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      taskId: request.taskId,
      serviceId: request.serviceId,
      queryIndex: task.entries.length,
      amountWei: request.amountWei,
      timestamp: Date.now(),
      memo: request.memo || '',
      path: request.path,
      idempotencyKey: request.idempotencyKey,
    };

    // Record the spend
    task.entries.push(entry);
    task.spentWei = newTotal;
    this.idempotencyKeys.set(fullIdempotencyKey, entry);

    return {
      success: true,
      spentWei: task.spentWei,
      entry,
    };
  }

  /**
   * Get total spend for a task, broken down by payment path.
   */
  getTotals(taskId: string): SpendTotals {
    const task = this.tasks.get(taskId);
    if (!task) {
      return { totalWei: BigInt(0), byPath: {} as Record<SpendPath, bigint> };
    }

    const totals: SpendTotals = {
      totalWei: task.spentWei,
      byPath: {
        TREASURY: BigInt(0),
        DIRECT_MPP: BigInt(0),
        LLM: BigInt(0),
      },
    };

    for (const entry of task.entries) {
      totals.byPath[entry.path] += entry.amountWei;
    }

    return totals;
  }

  /**
   * Get all spend entries for a task.
   */
  getEntries(taskId: string): SpendLedgerEntry[] {
    const task = this.tasks.get(taskId);
    return task ? [...task.entries] : [];
  }

  /**
   * Get task record.
   */
  getTask(taskId: string): TaskRecord | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get remaining budget for a task.
   */
  getRemainingBudget(taskId: string): bigint {
    const task = this.tasks.get(taskId);
    if (!task) {
      return BigInt(0);
    }
    return task.budgetWei - task.spentWei;
  }

  /**
   * Update task status.
   */
  updateTaskStatus(taskId: string, status: TaskStatus): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = status;
    }
  }

  /**
   * Close and remove a task from the ledger.
   */
  closeTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      // Clean up idempotency keys
      for (const entry of task.entries) {
        this.idempotencyKeys.delete(`${entry.taskId}:${entry.idempotencyKey}`);
      }
      this.tasks.delete(taskId);
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new spend ledger instance.
 */
export function createSpendLedger(): SpendLedger {
  return new SpendLedger();
}