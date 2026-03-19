/**
 * Monitor Domain Types
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

export interface SpendEntry {
  id: string;
  taskId: string;
  serviceId: string;
  queryIndex: number;
  amountWei: bigint;
  timestamp: number;
  memo: string;
}

export interface Task {
  id: string;
  prompt: string;
  budgetWei: bigint;
  spentWei: bigint;
  status: TaskStatus;
  createdAt: number;
  deadline: number;
  sources: string[];
  enhancements: EnhancementToggles;
}

export interface EnhancementToggles {
  coverImage: boolean;
  audioBriefing: boolean;
  uploadDelivery: boolean;
  emailDelivery: boolean;
}

export type WSEventType =
  | 'status'
  | 'source'
  | 'query'
  | 'reasoning'
  | 'enhancement'
  | 'spend'
  | 'complete'
  | 'error';

export interface WSEvent {
  type: WSEventType;
  taskId: string;
  timestamp: number;
  payload: unknown;
}

export const PROVIDER_IDS = {
  // Direct MPP providers
  EXA: 'exa',
  ALLIUM: 'allium',
  PERPLEXITY: 'perplexity',
  // Wrapped/proxy providers
  DEFI_STATS: 'defi-stats',
  NEWS: 'news',
  // Premium Treasury-backed providers
  CERN_TEMPORAL: 'cern-temporal',
  CIA_DECLASSIFIED: 'cia-declassified',
} as const;

export type ProviderId = typeof PROVIDER_IDS[keyof typeof PROVIDER_IDS];