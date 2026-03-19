/**
 * Monitor Constants
 *
 * Chain IDs, token addresses, contract addresses, and other static values.
 * These values are canonical across all components (backend, web, proxy).
 */

// =============================================================================
// Chain Configuration
// =============================================================================

/**
 * Tempo chain ID (Rollup on Ethereum).
 */
export const TEMPO_CHAIN_ID = 648000n;

/**
 * Ethereum mainnet chain ID (for reference).
 */
export const ETHEREUM_CHAIN_ID = 1n;

/**
 * Supported chain IDs.
 */
export const SUPPORTED_CHAIN_IDS = [
  ETHEREUM_CHAIN_ID,
  TEMPO_CHAIN_ID,
] as const;

// =============================================================================
// Token Addresses
// =============================================================================

/**
 * Native token address (ETH, TEMPO).
 * Used for treasury budget and refunds.
 */
export const NATIVE_TOKEN = '0x0000000000000000000000000000000000000000' as const;

/**
 * Path USD token address (placeholder).
 * Will be updated when deployed.
 */
export const PATH_USD = '0x0000000000000000000000000000000000000002' as const;

// =============================================================================
// Contract Addresses (Placeholders)
// =============================================================================

/**
 * Monitor Treasury contract address.
 * Updated during deployment.
 */
export const TREASURY_ADDRESS = '0x0000000000000000000000000000000000000001' as const;

/**
 * Split Settlement contract address (stretch goal).
 */
export const SPLIT_SETTLEMENT_ADDRESS = '0x0000000000000000000000000000000000000003' as const;

// =============================================================================
// Budget Defaults
// =============================================================================

/**
 * Default budget: 1 ETH equivalent in wei.
 */
export const DEFAULT_BUDGET_WEI = BigInt('1000000000000000000');

/**
 * Default deadline: 1 hour in seconds.
 */
export const DEFAULT_DEADLINE_SECONDS = 3600;

/**
 * Minimum budget: 0.01 ETH.
 */
export const MIN_BUDGET_WEI = BigInt('10000000000000000');

/**
 * Maximum budget: 100 ETH.
 */
export const MAX_BUDGET_WEI = BigInt('100000000000000000000');

// =============================================================================
// Memo Field Sizes
// =============================================================================

/**
 * Total memo size: 32 bytes (EVM word).
 */
export const MEMO_TOTAL_BYTES = 32;

/**
 * Task ID field size: 16 bytes.
 * First 16 bytes of task ID hash.
 */
export const MEMO_TASK_ID_BYTES = 16;

/**
 * Service ID field size: 8 bytes.
 * Mapped via SERVICE_SLOTS in memo.ts.
 */
export const MEMO_SERVICE_ID_BYTES = 8;

/**
 * Query index field size: 8 bytes.
 * Big-endian uint64.
 */
export const MEMO_QUERY_INDEX_BYTES = 8;

// =============================================================================
// Gas Constants
// =============================================================================

/**
 * Gas limit for treasury operations.
 */
export const TREASURY_GAS_LIMIT = 500000n;

/**
 * Gas limit for createTask (includes transfer).
 */
export const CREATE_TASK_GAS_LIMIT = 300000n;

/**
 * Gas limit for spend/recordSpend.
 */
export const SPEND_GAS_LIMIT = 150000n;

/**
 * Gas limit for closeTask (includes refund).
 */
export const CLOSE_TASK_GAS_LIMIT = 200000n;

// =============================================================================
// WebSocket Event Types
// =============================================================================

/**
 * WebSocket event type constants.
 * Must match WSEventType in types.ts.
 */
export const WS_EVENT_TYPES = {
  STATUS: 'status',
  SOURCE: 'source',
  QUERY: 'query',
  REASONING: 'reasoning',
  ENHANCEMENT: 'enhancement',
  SPEND: 'spend',
  COMPLETE: 'complete',
  ERROR: 'error',
} as const;

// =============================================================================
// HTTP Status Codes
// =============================================================================

/**
 * HTTP status codes used in the API.
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  PAYMENT_REQUIRED: 402,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
} as const;

// =============================================================================
// Task Status Timeline
// =============================================================================

/**
 * Valid state transitions for tasks.
 * Key is current state, value is array of valid next states.
 */
export const VALID_TRANSITIONS: Record<string, string[]> = {
  CREATED: ['FUNDING', 'FAILED'],
  FUNDING: ['RUNNING', 'FAILED', 'STOPPED'],
  RUNNING: ['COMPILING', 'FAILED', 'STOPPED'],
  COMPILING: ['ENHANCING', 'COMPLETE', 'FAILED'],
  ENHANCING: ['COMPLETE', 'FAILED'],
  COMPLETE: [],
  FAILED: [],
  STOPPED: [],
} as const;

// =============================================================================
// Feature Flags
// =============================================================================

/**
 * Feature flags for optional functionality.
 */
export const FEATURES = {
  /** Enable passkey authentication */
  PASSKEY_AUTH: false,
  /** Enable fee sponsorship */
  FEE_SPONSORSHIP: false,
  /** Enable audio briefings */
  AUDIO_BRIEFING: false,
  /** Enable upload delivery */
  UPLOAD_DELIVERY: false,
  /** Enable email delivery */
  EMAIL_DELIVERY: false,
} as const;