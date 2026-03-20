import type { FeedEntry, RehydrateResult, TaskRecord } from './api';

export type SpendPath = 'TREASURY' | 'DIRECT_MPP' | 'LLM';

export interface AuditEntry {
  id: string;
  serviceId: string;
  message: string;
  timestamp: number;
  amountWei: bigint;
  path: SpendPath;
  memo: string;
  queryIndex: number;
}

export interface SpendTotals {
  totalWei: bigint;
  byPath: Record<SpendPath, bigint>;
}

export interface SpendConsistency {
  kind: 'reconciled' | 'mismatch';
  deltaWei: bigint;
}

export interface ResultsViewModel {
  task: TaskRecord;
  report: string;
  auditEntries: AuditEntry[];
  totals: SpendTotals;
  refundWei: bigint;
  consistency: SpendConsistency;
}

interface SpendPayload {
  path?: unknown;
  memo?: unknown;
  queryIndex?: unknown;
  report?: unknown;
  data?: {
    report?: unknown;
  };
}

const ZERO_TOTALS = (): SpendTotals => ({
  totalWei: BigInt(0),
  byPath: {
    TREASURY: BigInt(0),
    DIRECT_MPP: BigInt(0),
    LLM: BigInt(0),
  },
});

function parseBigInt(value: bigint | number | string | undefined): bigint {
  if (typeof value === 'bigint') {
    return value;
  }

  if (typeof value === 'number') {
    return BigInt(value);
  }

  if (typeof value === 'string' && value.length > 0) {
    return BigInt(value);
  }

  return BigInt(0);
}

function asSpendPath(value: unknown, serviceId: string, memo: string): SpendPath {
  if (value === 'TREASURY' || value === 'DIRECT_MPP' || value === 'LLM') {
    return value;
  }

  if (serviceId.startsWith('llm')) {
    return 'LLM';
  }

  if (memo) {
    return 'TREASURY';
  }

  return 'DIRECT_MPP';
}

function extractReport(feedEntries: FeedEntry[]): string {
  const completeEntries = feedEntries
    .filter((entry) => entry.type === 'complete')
    .sort((a, b) => b.timestamp - a.timestamp);

  for (const entry of completeEntries) {
    const payload = (entry.payload ?? {}) as SpendPayload;

    if (typeof payload.report === 'string' && payload.report.trim().length > 0) {
      return payload.report;
    }

    if (typeof payload.data?.report === 'string' && payload.data.report.trim().length > 0) {
      return payload.data.report;
    }
  }

  return '';
}

function extractAuditEntries(feedEntries: FeedEntry[]): AuditEntry[] {
  return feedEntries
    .filter((entry) => entry.type === 'spend')
    .map((entry) => {
      const payload = (entry.payload ?? {}) as SpendPayload;
      const memo = typeof payload.memo === 'string' ? payload.memo : '';

      return {
        id: entry.id,
        serviceId: entry.serviceId ?? 'unknown-service',
        message: entry.message,
        timestamp: entry.timestamp,
        amountWei: parseBigInt(entry.amountWei),
        path: asSpendPath(payload.path, entry.serviceId ?? 'unknown-service', memo),
        memo,
        queryIndex: typeof payload.queryIndex === 'number' ? payload.queryIndex : 0,
      };
    })
    .sort((a, b) => a.timestamp - b.timestamp);
}

function aggregateAuditEntries(entries: AuditEntry[]): SpendTotals {
  const totals = ZERO_TOTALS();

  for (const entry of entries) {
    totals.totalWei += entry.amountWei;
    totals.byPath[entry.path] += entry.amountWei;
  }

  return totals;
}

export function formatEth(wei: bigint): string {
  return `${(Number(wei) / 1e18).toFixed(4)} ETH`;
}

export function buildResultsViewModel(data: RehydrateResult): ResultsViewModel {
  const auditEntries = extractAuditEntries(data.feedEntries);
  const totals = aggregateAuditEntries(auditEntries);
  const taskSpentWei = parseBigInt(data.task.spentWei);
  const budgetWei = parseBigInt(data.task.budgetWei);
  const deltaWei =
    taskSpentWei >= totals.totalWei ? taskSpentWei - totals.totalWei : totals.totalWei - taskSpentWei;

  return {
    task: data.task,
    report: extractReport(data.feedEntries),
    auditEntries,
    totals,
    refundWei: budgetWei > taskSpentWei ? budgetWei - taskSpentWei : BigInt(0),
    consistency: {
      kind: deltaWei === BigInt(0) ? 'reconciled' : 'mismatch',
      deltaWei,
    },
  };
}
