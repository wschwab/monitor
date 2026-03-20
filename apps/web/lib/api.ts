/**
 * API Client
 *
 * Typed fetch wrappers for the Monitor backend REST API.
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

export interface CreateTaskPayload {
  prompt: string;
  budgetEth: number;
  deadlineSeconds: number;
  sources: string[];
  owner?: string;
}

export interface TaskRecord {
  id: string;
  prompt: string;
  status: string;
  budgetWei: string;
  spentWei: string;
  createdAt: number;
  deadline: number;
  sources: string[];
  owner: string;
}

export interface RehydrateResult {
  task: TaskRecord;
  feedEntries: FeedEntry[];
}

export interface FeedEntry {
  id: string;
  type: string;
  message: string;
  timestamp: number;
  amountWei?: string;
  serviceId?: string;
  payload?: unknown;
}

export async function createTask(payload: CreateTaskPayload): Promise<{ task: TaskRecord }> {
  const budgetWei = BigInt(Math.round(payload.budgetEth * 1e18)).toString();

  const res = await fetch(`${BACKEND_URL}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: payload.prompt,
      budgetWei,
      deadlineSeconds: payload.deadlineSeconds,
      owner: payload.owner ?? '0x0000000000000000000000000000000000000000',
      sources: payload.sources,
      enhancements: {},
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error((err as any).error ?? `HTTP ${res.status}`);
  }

  return res.json();
}

export async function rehydrateTask(taskId: string): Promise<RehydrateResult> {
  const res = await fetch(`${BACKEND_URL}/tasks/${taskId}/rehydrate`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function stopTask(taskId: string): Promise<void> {
  await fetch(`${BACKEND_URL}/tasks/${taskId}/stop`, { method: 'POST' });
}
