/**
 * Exa Provider Adapter
 *
 * Real Exa search provider with:
 *   - 402 payment-required handling
 *   - Spend-ledger reconciliation (DIRECT_MPP path)
 *   - Idempotency key deduplication
 *   - Timeout + demo fallback
 */

import { SpendLedger } from '../spend-ledger';
import { MPPClient, FetchFn, createMPPClient } from '../mpp-client';

// =============================================================================
// Types
// =============================================================================

export interface ExaSearchResult {
  title: string;
  url: string;
  text: string;
  score: number;
}

export interface ExaSearchData {
  results: ExaSearchResult[];
  autopromptString?: string;
}

export interface ExaSearchRequest {
  taskId: string;
  query: string;
  numResults?: number;
  idempotencyKey?: string;
}

export interface ExaSpendEntry {
  id: string;
  amountWei: bigint;
  path: 'DIRECT_MPP';
  serviceId: string;
  memo: string;
  queryIndex: number;
}

export interface ExaSearchResponse {
  success: boolean;
  data: ExaSearchData | null;
  error?: string;
  spendEntry?: ExaSpendEntry;
  fromDemo?: boolean;
}

export interface ExaAdapterOptions {
  spendLedger: SpendLedger;
  apiKey: string;
  demoMode?: boolean;
  fallbackToDemo?: boolean;
  timeoutMs?: number;
  fetchFn?: FetchFn;
}

// =============================================================================
// Constants
// =============================================================================

const EXA_BASE_URL = 'https://api.exa.ai';
const EXA_SERVICE_ID = 'exa';
const EXA_COST_WEI = BigInt('10000000000000000'); // 0.01 USDC
const DEFAULT_NUM_RESULTS = 5;

// =============================================================================
// Demo Fixtures
// =============================================================================

const DEMO_FIXTURES: ExaSearchData[] = [
  {
    results: [
      {
        title: 'CERN Classified Archive: Hououin Kyouma Incident Report',
        url: 'https://opendata.cern.ch/records/kyouma-dossier-classified',
        text: 'Subject: Hououin Kyouma. Alias of an individual who gained unauthorized access to LHC control systems. Temporal divergence meter readings: 1.048596. Status: ACTIVE. El Psy Kongroo.',
        score: 0.99,
      },
      {
        title: 'LHC Anomalous Temporal Readings — 2010 Incident Log',
        url: 'https://opendata.cern.ch/records/lhc-temporal-2010',
        text: 'During routine beam tests, instruments detected unexplained backward causal signals. Source traced to lab environment in Akihabara, Tokyo.',
        score: 0.91,
      },
    ],
    autopromptString: 'CERN classified dossier Hououin Kyouma time machine temporal anomaly',
  },
  {
    results: [
      {
        title: 'Quantum Computing Breakthroughs 2024',
        url: 'https://example.com/quantum-2024',
        text: 'Recent advances in quantum error correction have brought fault-tolerant quantum computing closer to reality...',
        score: 0.88,
      },
      {
        title: 'Scalable Qubit Architecture Review',
        url: 'https://example.com/qubits',
        text: 'New superconducting qubit designs achieve coherence times exceeding 1 millisecond...',
        score: 0.82,
      },
    ],
    autopromptString: 'quantum computing research breakthroughs 2024',
  },
];

// =============================================================================
// Exa Adapter
// =============================================================================

export class ExaAdapter {
  private spendLedger: SpendLedger;
  private apiKey: string;
  private demoMode: boolean;
  private fallbackToDemo: boolean;
  private timeoutMs: number;
  private client: MPPClient;

  constructor(options: ExaAdapterOptions) {
    this.spendLedger = options.spendLedger;
    this.apiKey = options.apiKey;
    this.demoMode = options.demoMode ?? false;
    this.fallbackToDemo = options.fallbackToDemo ?? false;
    this.timeoutMs = options.timeoutMs ?? 30_000;

    this.client = createMPPClient({
      apiKey: this.apiKey,
      baseUrl: EXA_BASE_URL,
      timeoutMs: this.timeoutMs,
      fetchFn: options.fetchFn,
    });
  }

  /**
   * Search using Exa. Handles payment, spend reconciliation, and fallbacks.
   */
  async search(request: ExaSearchRequest): Promise<ExaSearchResponse> {
    // Guard: missing API key in live mode
    if (!this.demoMode && !this.apiKey) {
      if (this.fallbackToDemo) {
        return this.demoSearch(request);
      }

      return {
        success: false,
        data: null,
        error: 'EXA_API_KEY_NOT_SET',
      };
    }

    // Demo mode: return fixture
    if (this.demoMode) {
      return this.demoSearch(request);
    }

    // Live mode
    return this.liveSearch(request);
  }

  // ---------------------------------------------------------------------------
  // Demo Search
  // ---------------------------------------------------------------------------

  private async demoSearch(request: ExaSearchRequest): Promise<ExaSearchResponse> {
    // Try to record spend — honour budget limits even in demo mode
    const idempotencyKey =
      request.idempotencyKey ?? `exa-demo-${request.taskId}-${Date.now()}`;

    const spendResult = this.spendLedger.recordSpend({
      taskId: request.taskId,
      serviceId: EXA_SERVICE_ID,
      amountWei: EXA_COST_WEI,
      path: 'DIRECT_MPP',
      idempotencyKey,
    });

    if (!spendResult.success) {
      return {
        success: false,
        data: null,
        error: spendResult.error ?? 'SPEND_FAILED',
      };
    }

    // Pick a fixture based on query content
    const query = request.query.toLowerCase();
    const fixture =
      query.includes('kyouma') || query.includes('cern') || query.includes('classified')
        ? DEMO_FIXTURES[0]
        : DEMO_FIXTURES[1];

    const spendEntry: ExaSpendEntry | undefined = spendResult.entry
      ? {
          id: spendResult.entry.id,
          amountWei: spendResult.entry.amountWei,
          path: 'DIRECT_MPP',
          serviceId: EXA_SERVICE_ID,
          memo: spendResult.entry.memo,
          queryIndex: spendResult.entry.queryIndex,
        }
      : undefined;

    return {
      success: true,
      data: {
        ...fixture,
        results: fixture.results.slice(0, request.numResults ?? DEFAULT_NUM_RESULTS),
      },
      spendEntry,
      fromDemo: true,
    };
  }

  // ---------------------------------------------------------------------------
  // Live Search
  // ---------------------------------------------------------------------------

  private async liveSearch(request: ExaSearchRequest): Promise<ExaSearchResponse> {
    const idempotencyKey =
      request.idempotencyKey ?? `exa-${request.taskId}-${Date.now()}`;

    try {
      const response = await this.client.request<ExaSearchData>({
        path: '/search',
        body: {
          query: request.query,
          numResults: request.numResults ?? DEFAULT_NUM_RESULTS,
          type: 'neural',
          useAutoprompt: true,
          contents: { text: true },
        },
        idempotencyKey,
      });

      // 402: record spend and retry once
      if (!response.ok && response.status === 402) {
        const costWei = response.paymentRequiredWei ?? EXA_COST_WEI;
        const spendResult = this.spendLedger.recordSpend({
          taskId: request.taskId,
          serviceId: EXA_SERVICE_ID,
          amountWei: costWei,
          path: 'DIRECT_MPP',
          idempotencyKey,
        });

        if (!spendResult.success) {
          return {
            success: false,
            data: null,
            error: spendResult.error ?? 'SPEND_FAILED',
          };
        }

        // Retry after payment
        const retryResponse = await this.client.request<ExaSearchData>({
          path: '/search',
          body: {
            query: request.query,
            numResults: request.numResults ?? DEFAULT_NUM_RESULTS,
            type: 'neural',
            useAutoprompt: true,
            contents: { text: true },
          },
          idempotencyKey: `${idempotencyKey}-retry`,
        });

        if (!retryResponse.ok) {
          return { success: false, data: null, error: retryResponse.error };
        }

        const spendEntry: ExaSpendEntry | undefined = spendResult.entry
          ? {
              id: spendResult.entry.id,
              amountWei: spendResult.entry.amountWei,
              path: 'DIRECT_MPP',
              serviceId: EXA_SERVICE_ID,
              memo: spendResult.entry.memo,
              queryIndex: spendResult.entry.queryIndex,
            }
          : undefined;

        return { success: true, data: retryResponse.data, spendEntry };
      }

      // Non-OK non-402 response
      if (!response.ok) {
        if (this.fallbackToDemo) {
          return this.demoSearch({ ...request, idempotencyKey });
        }
        return { success: false, data: null, error: response.error };
      }

      // Success — record spend
      const spendResult = this.spendLedger.recordSpend({
        taskId: request.taskId,
        serviceId: EXA_SERVICE_ID,
        amountWei: EXA_COST_WEI,
        path: 'DIRECT_MPP',
        idempotencyKey,
      });

      const spendEntry: ExaSpendEntry | undefined = spendResult.entry
        ? {
            id: spendResult.entry.id,
            amountWei: spendResult.entry.amountWei,
            path: 'DIRECT_MPP',
            serviceId: EXA_SERVICE_ID,
            memo: spendResult.entry.memo,
            queryIndex: spendResult.entry.queryIndex,
          }
        : undefined;

      return { success: true, data: response.data, spendEntry };
    } catch (err) {
      // Network error / timeout
      if (this.fallbackToDemo) {
        return this.demoSearch({ ...request, idempotencyKey });
      }
      const message = err instanceof Error ? err.message : 'UNKNOWN_ERROR';
      return { success: false, data: null, error: message };
    }
  }
}
