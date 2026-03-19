/**
 * Monitor Constants
 *
 * Chain IDs, token addresses, contract addresses, and other static values.
 */

// Chain configuration
export const TEMPO_CHAIN_ID = 648000n;

// Token addresses (placeholder - will be updated for deployment)
export const NATIVE_TOKEN = '0x0000000000000000000000000000000000000000' as const;

// Placeholder addresses (will be set during deployment)
export const TREASURY_ADDRESS = '0x0000000000000000000000000000000000000001' as const;

// Budget defaults
export const DEFAULT_BUDGET_WEI = 1000000000000000000n; // 1 ETH equivalent
export const DEFAULT_DEADLINE_SECONDS = 3600; // 1 hour

// Memo field sizes (32 bytes total)
export const MEMO_TASK_ID_BYTES = 16;
export const MEMO_SERVICE_ID_BYTES = 8;
export const MEMO_QUERY_INDEX_BYTES = 8;