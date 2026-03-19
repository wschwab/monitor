/**
 * MPP Client
 *
 * Factory and types for direct MPP (Machine Payment Protocol) provider requests.
 * Handles 402 payment-required flow, idempotency, and spend reconciliation.
 */

// =============================================================================
// Types
// =============================================================================

export type FetchFn = typeof fetch;

export interface MPPClientOptions {
  apiKey: string;
  baseUrl: string;
  timeoutMs?: number;
  fetchFn?: FetchFn;
}

export interface MPPRequestOptions {
  method?: string;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  idempotencyKey?: string;
  timeoutMs?: number;
}

export interface MPPResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
  /** Set on 402 responses — amount provider requested */
  paymentRequiredWei?: bigint;
}

// =============================================================================
// MPP Client
// =============================================================================

export class MPPClient {
  private apiKey: string;
  private baseUrl: string;
  private timeoutMs: number;
  private fetchFn: FetchFn;

  constructor(options: MPPClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  /**
   * Make an authenticated request.
   * On 402, returns paymentRequiredWei so the caller can
   * record spend and retry.
   */
  async request<T = unknown>(opts: MPPRequestOptions): Promise<MPPResponse<T>> {
    const url = `${this.baseUrl}${opts.path}`;
    const timeoutMs = opts.timeoutMs ?? this.timeoutMs;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
      ...(opts.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}),
      ...(opts.headers ?? {}),
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await this.fetchFn(url, {
        method: opts.method ?? 'POST',
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (res.status === 402) {
        let paymentRequiredWei: bigint | undefined;
        try {
          const body = await res.json() as { amountWei?: string };
          if (body.amountWei) {
            paymentRequiredWei = BigInt(body.amountWei);
          }
        } catch {
          // ignore parse errors on 402 body
        }
        return {
          ok: false,
          status: 402,
          data: null,
          error: 'PAYMENT_REQUIRED',
          paymentRequiredWei,
        };
      }

      if (!res.ok) {
        let errMsg = `HTTP_${res.status}`;
        try {
          const body = await res.json() as { error?: string };
          if (body.error) errMsg = body.error;
        } catch {
          // ignore
        }
        return { ok: false, status: res.status, data: null, error: errMsg };
      }

      const data = await res.json() as T;
      return { ok: true, status: res.status, data };
    } catch (err) {
      clearTimeout(timer);
      const message = err instanceof Error ? err.message : 'UNKNOWN_ERROR';
      return { ok: false, status: 0, data: null, error: message };
    }
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createMPPClient(options: MPPClientOptions): MPPClient {
  return new MPPClient(options);
}
