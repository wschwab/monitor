/**
 * Monitor Domain Types
 *
 * Canonical types shared across backend, frontend, and proxy.
 * These types define the core data structures for the Monitor system.
 */

// =============================================================================
// Task Status
// =============================================================================

/**
 * Lifecycle states for a research task.
 *
 * State transitions:
 * - CREATED -> FUNDING: User submits task, awaiting budget deposit
 * - FUNDING -> RUNNING: Budget confirmed, agent begins execution
 * - RUNNING -> COMPILING: Agent finishes queries, synthesizing report
 * - COMPILING -> ENHANCING: Report ready, applying enhancements (if any)
 * - ENHANCING -> COMPLETE: All done, refund processed
 *
 * Failure paths:
 * - Any state -> FAILED: Unrecoverable error
 * - Any state -> STOPPED: User emergency stop
 */
export type TaskStatus =
  | 'CREATED'
  | 'FUNDING'
  | 'RUNNING'
  | 'COMPILING'
  | 'ENHANCING'
  | 'COMPLETE'
  | 'FAILED'
  | 'STOPPED';

// =============================================================================
// Spend Tracking
// =============================================================================

/**
 * Payment path for a spend entry.
 * - TREASURY: Premium provider paid through MonitorTreasury contract
 * - DIRECT_MPP: Direct provider paid via MPP client
 * - LLM: LLM reasoning cost
 */
export type SpendPath = 'TREASURY' | 'DIRECT_MPP' | 'LLM';

/**
 * Individual spend record for a task.
 *
 * Each query/tool call produces one SpendEntry. The memo field
 * contains the 32-byte on-chain encoded data for Treasury spend.
 */
export interface SpendEntry {
  /** Unique identifier for this spend entry */
  id: string;
  /** Task this spend belongs to */
  taskId: string;
  /** Provider/service that was paid */
  serviceId: string;
  /** Index of this query within the task execution */
  queryIndex: number;
  /** Amount spent in wei */
  amountWei: bigint;
  /** Unix timestamp (milliseconds) */
  timestamp: number;
  /** 32-byte hex encoded memo (for Treasury entries) */
  memo: string;
  /** How this spend was processed */
  path: SpendPath;
}

// =============================================================================
// Task Definition
// =============================================================================

/**
 * Enhancement options that can be toggled per task.
 *
 * Each enhancement has an associated cost. Disabled enhancements
 * must never incur charges.
 */
export interface EnhancementToggles {
  /** Generate cover image for report */
  coverImage: boolean;
  /** Generate audio briefing of report */
  audioBriefing: boolean;
  /** Upload report to storage */
  uploadDelivery: boolean;
  /** Email report to user */
  emailDelivery: boolean;
}

/**
 * Default enhancement toggles (all disabled).
 */
export const DEFAULT_ENHANCEMENTS: EnhancementToggles = {
  coverImage: false,
  audioBriefing: false,
  uploadDelivery: false,
  emailDelivery: false,
} as const;

/**
 * Complete task definition.
 */
export interface Task {
  /** Unique task identifier (UUID) */
  id: string;
  /** User's research prompt */
  prompt: string;
  /** Total budget in wei */
  budgetWei: bigint;
  /** Total amount spent in wei */
  spentWei: bigint;
  /** Current lifecycle state */
  status: TaskStatus;
  /** Creation timestamp (ms) */
  createdAt: number;
  /** Deadline timestamp (ms) */
  deadline: number;
  /** Selected data sources */
  sources: ProviderId[];
  /** Enhancement toggles */
  enhancements: EnhancementToggles;
  /** User/agent address */
  owner: string;
}

// =============================================================================
// WebSocket Events
// =============================================================================

/**
 * WebSocket event types for real-time updates.
 */
export type WSEventType =
  | 'status'      // TaskStatus change
  | 'source'      // Data source started/completed
  | 'query'        // Individual query execution
  | 'reasoning'   // LLM thinking/reasoning
  | 'enhancement'  // Enhancement progress
  | 'spend'       // Spend entry recorded
  | 'complete'    // Final report ready
  | 'error';      // Error occurred

/**
 * WebSocket event envelope.
 */
export interface WSEvent<T = unknown> {
  /** Event type discriminator */
  type: WSEventType;
  /** Task this event belongs to */
  taskId: string;
  /** Unix timestamp (ms) */
  timestamp: number;
  /** Event-specific payload */
  payload: T;
}

// =============================================================================
// Provider IDs
// =============================================================================

/**
 * All available provider/service IDs.
 *
 * These IDs must exactly match:
 * - Backend tool names in apps/backend/src/tools/
 * - UI selector values in apps/web/
 * - Proxy discovery endpoints in apps/data-proxy/
 */
export const PROVIDER_IDS = {
  // Direct MPP providers (pay via MPP client)
  EXA: 'exa',
  ALLIUM: 'allium',
  PERPLEXITY: 'perplexity',

  // Wrapped/proxy providers (free or backend-proxied)
  DEFI_STATS: 'defi-stats',
  NEWS: 'news',

  // Premium Treasury-backed providers
  CERN_TEMPORAL: 'cern-temporal',
  CIA_DECLASSIFIED: 'cia-declassified',
} as const;

/**
 * Union type of all provider IDs.
 */
export type ProviderId = typeof PROVIDER_IDS[keyof typeof PROVIDER_IDS];

/**
 * Provider categories for UI grouping.
 */
export const PROVIDER_CATEGORIES = {
  direct: ['exa', 'allium', 'perplexity'] as ProviderId[],
  wrapped: ['defi-stats', 'news'] as ProviderId[],
  premium: ['cern-temporal', 'cia-declassified'] as ProviderId[],
} as const;

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Task creation request from frontend.
 */
export interface CreateTaskRequest {
  prompt: string;
  budgetWei: string;  // string to avoid bigint serialization issues
  deadlineSeconds: number;
  sources: ProviderId[];
  enhancements: EnhancementToggles;
}

/**
 * Task creation response.
 */
export interface CreateTaskResponse {
  taskId: string;
  fundingAddress: string;  // Address to send budget to
  budgetWei: string;
  deadline: number;
}

// =============================================================================
// Task Record (Full Task with Metadata)
// =============================================================================

/**
 * Complete task record stored in backend.
 */
export interface TaskRecord {
  id: string;
  prompt: string;
  budgetWei: bigint;
  spentWei: bigint;
  status: TaskStatus;
  createdAt: number;
  deadline: number;
  sources: string[];
  enhancements: EnhancementToggles;
  owner: string;
}

// =============================================================================
// Feed Entry
// =============================================================================

/**
 * Feed entry type for real-time updates.
 */
export type FeedEntryType =
  | 'status'
  | 'source'
  | 'query'
  | 'reasoning'
  | 'enhancement'
  | 'spend'
  | 'complete'
  | 'error';

/**
 * Individual feed entry for task activity stream.
 */
export interface FeedEntry {
  id: string;
  type: FeedEntryType;
  message: string;
  timestamp: number;
  amountWei?: bigint;
  serviceId?: string;
  payload?: unknown;
}