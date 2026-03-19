/**
 * Spend Policy
 *
 * Shared spend semantics and validation rules used across backend, contracts, and UI.
 * Defines canonical behavior for budget enforcement, deadline checks, and idempotency.
 */

import { TaskStatus, SpendPath } from './types';
import { VALID_TRANSITIONS } from './constants';

// =============================================================================
// Spend Policy Types
// =============================================================================

/**
 * Result of a spend validation check.
 */
export interface SpendValidationResult {
  valid: boolean;
  reason?: SpendRejectionReason;
  message: string;
}

/**
 * Reasons a spend can be rejected.
 */
export type SpendRejectionReason =
  | 'TASK_NOT_FOUND'
  | 'TASK_NOT_ACTIVE'
  | 'DEADLINE_PASSED'
  | 'BUDGET_EXCEEDED'
  | 'DUPLICATE_IDEMPOTENCY_KEY'
  | 'INVALID_AMOUNT'
  | 'INVALID_PATH';

// =============================================================================
// Active Status Check
// =============================================================================

/**
 * Task statuses that allow spend recording.
 * Tasks in terminal states (COMPLETE, FAILED, STOPPED) cannot accept new spend.
 */
export const ACTIVE_STATUSES: readonly TaskStatus[] = [
  'FUNDING',
  'RUNNING',
  'COMPILING',
  'ENHANCING',
] as const;

/**
 * Check if a task status allows spend recording.
 */
export function isTaskActive(status: TaskStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

/**
 * Terminal statuses that block further spend.
 */
export const TERMINAL_STATUSES: readonly TaskStatus[] = [
  'COMPLETE',
  'FAILED',
  'STOPPED',
] as const;

/**
 * Check if a task has reached a terminal state.
 */
export function isTaskTerminal(status: TaskStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

// =============================================================================
// Budget Validation
// =============================================================================

/**
 * Validate that a spend amount does not exceed the remaining budget.
 */
export function validateBudget(
  currentSpent: bigint,
  budget: bigint,
  requestedAmount: bigint
): SpendValidationResult {
  if (requestedAmount <= BigInt(0)) {
    return {
      valid: false,
      reason: 'INVALID_AMOUNT',
      message: `Invalid spend amount: ${requestedAmount} (must be positive)`,
    };
  }

  const newTotal = currentSpent + requestedAmount;
  if (newTotal > budget) {
    return {
      valid: false,
      reason: 'BUDGET_EXCEEDED',
      message: `Spend would exceed budget: ${newTotal} > ${budget}`,
    };
  }

  return {
    valid: true,
    message: 'Budget check passed',
  };
}

/**
 * Calculate remaining budget.
 */
export function calculateRemaining(budget: bigint, spent: bigint): bigint {
  return budget - spent;
}

// =============================================================================
// Deadline Validation
// =============================================================================

/**
 * Get current timestamp in milliseconds.
 * Exposed for testing (can be mocked).
 */
export function getCurrentTimestamp(): number {
  return Date.now();
}

/**
 * Validate that the deadline has not passed.
 */
export function validateDeadline(
  deadlineMs: number,
  currentTimeMs: number = getCurrentTimestamp()
): SpendValidationResult {
  if (currentTimeMs > deadlineMs) {
    return {
      valid: false,
      reason: 'DEADLINE_PASSED',
      message: `Deadline passed: ${deadlineMs} < ${currentTimeMs}`,
    };
  }

  return {
    valid: true,
    message: 'Deadline check passed',
  };
}

// =============================================================================
// Idempotency
// =============================================================================

/**
 * Generate a full idempotency key from task + client key.
 */
export function makeIdempotencyKey(taskId: string, clientKey: string): string {
  return `${taskId}:${clientKey}`;
}

/**
 * Check if an idempotency key is valid format.
 */
export function isValidIdempotencyKey(key: string): boolean {
  return key.length > 0 && key.length <= 256;
}

// =============================================================================
// Spend Path Validation
// =============================================================================

/**
 * Valid spend paths.
 */
export const VALID_SPEND_PATHS: readonly SpendPath[] = [
  'TREASURY',
  'DIRECT_MPP',
  'LLM',
] as const;

/**
 * Validate a spend path.
 */
export function validateSpendPath(path: string): SpendValidationResult {
  if (!VALID_SPEND_PATHS.includes(path as SpendPath)) {
    return {
      valid: false,
      reason: 'INVALID_PATH',
      message: `Invalid spend path: ${path} (must be one of: ${VALID_SPEND_PATHS.join(', ')})`,
    };
  }

  return {
    valid: true,
    message: 'Path check passed',
  };
}

// =============================================================================
// Aggregate Validation
// =============================================================================

export interface TaskState {
  status: TaskStatus;
  budgetWei: bigint;
  spentWei: bigint;
  deadlineMs: number;
}

/**
 * Comprehensive spend validation combining all checks.
 */
export function validateSpend(
  state: TaskState,
  amountWei: bigint,
  idempotencyKey: string,
  seenKeys: Set<string>
): SpendValidationResult {
  // Check task status
  if (!isTaskActive(state.status)) {
    return {
      valid: false,
      reason: 'TASK_NOT_ACTIVE',
      message: `Task not active: ${state.status}`,
    };
  }

  // Check deadline
  const deadlineCheck = validateDeadline(state.deadlineMs);
  if (!deadlineCheck.valid) {
    return deadlineCheck;
  }

  // Check budget
  const budgetCheck = validateBudget(state.spentWei, state.budgetWei, amountWei);
  if (!budgetCheck.valid) {
    return budgetCheck;
  }

  // Check idempotency
  if (seenKeys.has(idempotencyKey)) {
    return {
      valid: false,
      reason: 'DUPLICATE_IDEMPOTENCY_KEY',
      message: `Duplicate idempotency key: ${idempotencyKey}`,
    };
  }

  return {
    valid: true,
    message: 'All checks passed',
  };
}

// =============================================================================
// Total Spend Aggregation
// =============================================================================

export interface SpendBreakdown {
  totalWei: bigint;
  byPath: Record<SpendPath, bigint>;
  byService: Record<string, bigint>;
}

/**
 * Aggregate spend entries into totals.
 */
export function aggregateSpends<T extends { amountWei: bigint; path: SpendPath; serviceId: string }>(
  entries: T[]
): SpendBreakdown {
  const result: SpendBreakdown = {
    totalWei: BigInt(0),
    byPath: {
      TREASURY: BigInt(0),
      DIRECT_MPP: BigInt(0),
      LLM: BigInt(0),
    },
    byService: {},
  };

  for (const entry of entries) {
    result.totalWei += entry.amountWei;
    result.byPath[entry.path] += entry.amountWei;
    result.byService[entry.serviceId] = (result.byService[entry.serviceId] || BigInt(0)) + entry.amountWei;
  }

  return result;
}

// =============================================================================
// Source of Truth Rules
// =============================================================================

/**
 * Defines the canonical source of truth for each spend type.
 *
 * - TREASURY: On-chain treasury log (verified via contract events)
 * - DIRECT_MPP: Backend ledger (reconciled from MPP client receipts)
 * - LLM: Backend ledger (from LLM provider billing)
 */
export const SOURCE_OF_TRUTH: Record<SpendPath, 'on-chain' | 'backend'> = {
  TREASURY: 'on-chain',
  DIRECT_MPP: 'backend',
  LLM: 'backend',
} as const;

/**
 * Check if a spend path requires on-chain verification.
 */
export function requiresOnChainVerification(path: SpendPath): boolean {
  return SOURCE_OF_TRUTH[path] === 'on-chain';
}

// =============================================================================
// In-Flight Request Handling
// =============================================================================

/**
 * Status transitions that cannot accept new spend during the transition.
 */
export const BLOCKING_TRANSITIONS: readonly TaskStatus[] = [
  'COMPLETE',
  'FAILED',
  'STOPPED',
] as const;

/**
 * Check if a status transition blocks in-flight requests.
 */
export function blocksInFlightRequests(from: TaskStatus, to: TaskStatus): boolean {
  return BLOCKING_TRANSITIONS.includes(to);
}

/**
 * Recommended timeout for in-flight spend requests (ms).
 */
export const IN_FLIGHT_TIMEOUT_MS = 30000; // 30 seconds

// =============================================================================
// Policy Summary
// =============================================================================

export interface SpendPolicy {
  activeStatuses: readonly TaskStatus[];
  terminalStatuses: readonly TaskStatus[];
  validPaths: readonly SpendPath[];
  sourceOfTruth: Record<SpendPath, 'on-chain' | 'backend'>;
  inFlightTimeoutMs: number;
}

/**
 * Get the complete spend policy.
 */
export function getSpendPolicy(): SpendPolicy {
  return {
    activeStatuses: ACTIVE_STATUSES,
    terminalStatuses: TERMINAL_STATUSES,
    validPaths: VALID_SPEND_PATHS,
    sourceOfTruth: SOURCE_OF_TRUTH,
    inFlightTimeoutMs: IN_FLIGHT_TIMEOUT_MS,
  };
}