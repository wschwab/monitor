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
  memoSummary?: string;
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

export interface CoverImage {
  imageUrl: string;
  title: string;
  alt: string;
}

export interface ResultsViewModel {
  task: TaskRecord;
  report: string;
  coverImage?: CoverImage;
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
  coverImage?: unknown;
  data?: {
    report?: unknown;
  };
}

const SLOT_TO_SERVICE: Record<string, string> = {
  exa00000: 'exa',
  allium00: 'allium',
  perplex0: 'perplexity',
  llm00000: 'llm',
  defist00: 'defi-stats',
  news0000: 'news',
  cerntm00: 'cern-temporal',
  ciadc000: 'cia-declassified',
  coverimg: 'cover-image',
  audio000: 'audio-tts',
};

function extractCoverImage(feedEntries: FeedEntry[]): CoverImage | undefined {
  const completeEntries = feedEntries
    .filter((entry) => entry.type === 'complete' || entry.type === 'enhancement')
    .sort((a, b) => b.timestamp - a.timestamp);

  for (const entry of completeEntries) {
    const payload = (entry.payload ?? {}) as SpendPayload;
    const coverImage = payload.coverImage;

    if (
      coverImage &&
      typeof coverImage === 'object' &&
      typeof (coverImage as Record<string, unknown>).imageUrl === 'string' &&
      typeof (coverImage as Record<string, unknown>).title === 'string' &&
      typeof (coverImage as Record<string, unknown>).alt === 'string'
    ) {
      return coverImage as CoverImage;
    }
  }

  return undefined;
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

function decodeAsciiHex(hex: string): string {
  let result = '';

  for (let index = 0; index < hex.length; index += 2) {
    result += String.fromCharCode(Number.parseInt(hex.slice(index, index + 2), 16));
  }

  return result;
}

function decodeMemoSummary(
  memo: string
): { taskRef: string; serviceId: string; queryIndex: number } | null {
  const hex = memo.startsWith('0x') ? memo.slice(2) : memo;

  if (hex.length !== 64) {
    return null;
  }

  try {
    const taskRef = `0x${hex.slice(0, 32)}`;
    const serviceSlot = decodeAsciiHex(hex.slice(32, 48));
    const queryIndex = Number.parseInt(hex.slice(48), 16);

    if (!Number.isFinite(queryIndex)) {
      return null;
    }

    return {
      taskRef,
      serviceId: SLOT_TO_SERVICE[serviceSlot] ?? `unknown:${hex.slice(32, 48)}`,
      queryIndex,
    };
  } catch {
    return null;
  }
}

function shortenTaskRef(taskRef: string): string {
  if (taskRef.length <= 16) {
    return taskRef;
  }

  return `${taskRef.slice(0, 10)}...${taskRef.slice(-6)}`;
}

function formatMemoSummary(
  memo: string,
  serviceId: string,
  queryIndex: number
): string | undefined {
  if (!memo) {
    return undefined;
  }

  const decoded = decodeMemoSummary(memo);

  if (!decoded) {
    return `Memo: ${memo}`;
  }

  const statusLabel =
    decoded.serviceId === serviceId && decoded.queryIndex === queryIndex
      ? 'Memo verified'
      : 'Memo decoded';

  return `${statusLabel}: ${decoded.serviceId} · query #${decoded.queryIndex} · task ${shortenTaskRef(decoded.taskRef)}`;
}

function extractAuditEntries(feedEntries: FeedEntry[]): AuditEntry[] {
  return feedEntries
    .filter((entry) => entry.type === 'spend')
    .map((entry) => {
      const payload = (entry.payload ?? {}) as SpendPayload;
      const memo = typeof payload.memo === 'string' ? payload.memo : '';
      const serviceId = entry.serviceId ?? 'unknown-service';
      const queryIndex = typeof payload.queryIndex === 'number' ? payload.queryIndex : 0;

      return {
        id: entry.id,
        serviceId,
        message: entry.message,
        timestamp: entry.timestamp,
        amountWei: parseBigInt(entry.amountWei),
        path: asSpendPath(payload.path, serviceId, memo),
        memo,
        memoSummary: formatMemoSummary(memo, serviceId, queryIndex),
        queryIndex,
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
  return `${(Number(wei) / 1e18).toFixed(4)} USDC`;
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
    coverImage: extractCoverImage(data.feedEntries),
    auditEntries,
    totals,
    refundWei: budgetWei > taskSpentWei ? budgetWei - taskSpentWei : BigInt(0),
    consistency: {
      kind: deltaWei === BigInt(0) ? 'reconciled' : 'mismatch',
      deltaWei,
    },
  };
}
