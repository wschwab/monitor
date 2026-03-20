/**
 * Premium Executor
 *
 * Handles premium provider queries with Treasury-backed billing.
 * Custom adapter seam that debits budget via spend-ledger before returning data.
 */

import { SpendLedger } from './spend-ledger';
import { SpendPath } from '@monitor/shared';

// =============================================================================
// Types
// =============================================================================

export type PremiumProvider = 'cern-temporal' | 'cia-declassified';

export interface PremiumQuery {
  taskId: string;
  provider: PremiumProvider;
  query: string;
}

export interface PremiumResult {
  success: boolean;
  provider: PremiumProvider;
  data: unknown | null;
  error?: string;
  spendEntry?: {
    id: string;
    amountWei: bigint;
    path: SpendPath;
    serviceId: string;
    memo: string;
    queryIndex: number;
  };
}

export interface PremiumExecutorOptions {
  spendLedger: SpendLedger;
  treasuryAddress: string;
}

// =============================================================================
// Premium Costs (in wei)
// =============================================================================

const PREMIUM_COSTS: Record<PremiumProvider, bigint> = {
  'cern-temporal': BigInt('100000000000000000'), // 0.1 ETH
  'cia-declassified': BigInt('100000000000000000'), // 0.1 ETH
};

// =============================================================================
// Mock Data Fixtures
// =============================================================================

interface FixtureData {
  [key: string]: string | number | string[] | undefined;
}

const CERN_FIXTURES: Record<string, FixtureData> = {
  'higgs boson discovery': {
    title: 'Higgs Boson Discovery at CERN',
    date: '2012-07-04',
    description: 'Discovery of a Higgs boson with mass around 125 GeV',
    experiment: 'ATLAS and CMS',
    confidence: '5 sigma',
  },
  'particle physics': {
    title: 'Standard Model of Particle Physics',
    description: 'The theoretical framework describing fundamental particles and forces',
    particles: ['Quarks', 'Leptons', 'Gauge Bosons', 'Higgs Boson'],
  },
  'lhc experiments': {
    title: 'Large Hadron Collider Experiments',
    experiments: ['ATLAS', 'CMS', 'ALICE', 'LHCb'],
    description: 'The four major experiments at the LHC',
  },
  'quantum mechanics': {
    title: 'Quantum Field Theory at CERN',
    description: 'Theoretical framework combining quantum mechanics and special relativity',
    concepts: ['Wave-particle duality', 'Uncertainty principle', 'Quantum entanglement'],
  },
};

const CIA_FIXTURES: Record<string, FixtureData> = {
  'cold war operations': {
    title: 'Cold War Intelligence Operations',
    period: '1947-1991',
    description: 'CIA operations during the Cold War era',
    declassified: '2010s',
  },
  'historical records': {
    title: 'Declassified Historical Records',
    description: 'Collection of declassified CIA documents',
    categories: ['Intelligence', 'Operations', 'Analysis'],
  },
};

// =============================================================================
// Premium Executor
// =============================================================================

export class PremiumExecutor {
  private spendLedger: SpendLedger;
  private treasuryAddress: string;

  constructor(options: PremiumExecutorOptions) {
    this.spendLedger = options.spendLedger;
    this.treasuryAddress = options.treasuryAddress;
  }

  /**
   * Fetch data from a premium provider with Treasury-backed billing.
   */
  async fetchPremiumData(query: PremiumQuery): Promise<PremiumResult> {
    const { taskId, provider, query: searchQuery } = query;

    try {
      // Check remaining budget first
      const remainingBudget = this.spendLedger.getRemainingBudget(taskId);
      const cost = PREMIUM_COSTS[provider];

      if (remainingBudget < cost) {
        return {
          success: false,
          provider,
          data: null,
          error: 'BUDGET_EXCEEDED',
        };
      }

      // Generate idempotency key for this query
      const idempotencyKey = this.generateIdempotencyKey(taskId, provider, searchQuery);

      // Fetch data from provider (mock implementation)
      const data = await this.fetchFromProvider(provider, searchQuery);

      // If no data found (404), return gracefully without spending
      if (!data) {
        return {
          success: false,
          provider,
          data: null,
          error: 'NOT_FOUND',
        };
      }

      // Record spend via Treasury (custom adapter seam, not mppx.charge)
      const spendResult = this.spendLedger.recordSpend({
        taskId,
        serviceId: provider,
        amountWei: cost,
        path: 'TREASURY',
        idempotencyKey,
      });

      if (!spendResult.success) {
        return {
          success: false,
          provider,
          data: null,
          error: spendResult.error || 'SPEND_FAILED',
        };
      }

      return {
        success: true,
        provider,
        data,
        spendEntry: {
          id: spendResult.entry?.id ?? `spend-${Date.now()}`,
          amountWei: spendResult.entry?.amountWei ?? cost,
          path: 'TREASURY',
          serviceId: provider,
          memo: spendResult.entry?.memo ?? '',
          queryIndex: spendResult.entry?.queryIndex ?? 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        provider,
        data: null,
        error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
      };
    }
  }

  /**
   * Generate deterministic idempotency key for query.
   */
  private generateIdempotencyKey(
    taskId: string,
    provider: PremiumProvider,
    query: string
  ): string {
    // Normalize query for consistent idempotency
    const normalizedQuery = query.toLowerCase().trim();
    return `${taskId}:${provider}:${normalizedQuery}`;
  }

  /**
   * Fetch data from premium provider (mock implementation).
   * Returns null if not found (404).
   */
  private async fetchFromProvider(
    provider: PremiumProvider,
    query: string
  ): Promise<unknown | null> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 50));

    // Check for network error test
    if (query === 'network-error-test') {
      throw new Error('Network error');
    }

    // Check for non-existent queries (404 simulation)
    if (query.includes('NONEXISTENT') || query.includes('not-found')) {
      return null;
    }

    // Check for classified/missing documents
    if (query.includes('CLASSIFIED')) {
      return null;
    }

    // Return fixture data based on query matching
    const normalizedQuery = query.toLowerCase().trim();

    if (provider === 'cern-temporal') {
      // Find matching fixture
      for (const [key, data] of Object.entries(CERN_FIXTURES)) {
        if (normalizedQuery.includes(key) || key.includes(normalizedQuery)) {
          return {
            ...data,
            source: 'CERN Open Data',
            query: normalizedQuery,
            timestamp: new Date().toISOString(),
          };
        }
      }

      // Generic CERN response for unmatched queries
      return {
        title: 'CERN Research Data',
        description: `Search results for "${query}"`,
        source: 'CERN Open Data',
        query: normalizedQuery,
        timestamp: new Date().toISOString(),
        note: 'Generic result - specific match not found in fixtures',
      };
    }

    if (provider === 'cia-declassified') {
      for (const [key, data] of Object.entries(CIA_FIXTURES)) {
        if (normalizedQuery.includes(key) || key.includes(normalizedQuery)) {
          return {
            ...data,
            source: 'CIA FOIA Reading Room',
            query: normalizedQuery,
            timestamp: new Date().toISOString(),
          };
        }
      }

      // Generic CIA response
      return {
        title: 'Declassified Document Search',
        description: `Search results for "${query}"`,
        source: 'CIA FOIA Reading Room',
        query: normalizedQuery,
        timestamp: new Date().toISOString(),
        note: 'Generic result - specific match not found in fixtures',
      };
    }

    return null;
  }

  /**
   * Get the cost for a premium provider.
   */
  getProviderCost(provider: PremiumProvider): bigint {
    return PREMIUM_COSTS[provider];
  }

  /**
   * List available premium providers.
   */
  getAvailableProviders(): PremiumProvider[] {
    return ['cern-temporal', 'cia-declassified'];
  }
}
