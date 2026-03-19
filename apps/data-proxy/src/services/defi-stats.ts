/**
 * DeFi Stats Service
 *
 * Wraps CoinGecko API for DeFi market data.
 * Supports live mode (API calls) and demo mode (fixtures).
 */

import { getDeFiStatsFixture } from '../demo-fixtures';

export interface CoinGeckoGlobalData {
  data: {
    active_cryptocurrencies: number;
    upcoming_icos: number;
    ongoing_icos: number;
    ended_icos: number;
    markets: number;
    total_market_cap: Record<string, number>;
    total_volume: Record<string, number>;
    market_cap_percentage: Record<string, number>;
    market_cap_change_percentage_24h_usd: number;
    updated_at: string;
  };
}

export interface CoinGeckoCoin {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
}

export interface DeFiStatsResponse {
  provider: 'coingecko' | 'demo';
  currency: string;
  timestamp: string;
  data: {
    total_market_cap: number;
    total_volume_24h: number;
    market_cap_change_24h: number;
    top_coins?: CoinGeckoCoin[];
  };
}

export interface ServiceOptions {
  demoMode?: boolean;
  apiKey?: string;
}

export class DeFiStatsService {
  private demoMode: boolean;
  private apiKey?: string;
  private baseUrl = 'https://api.coingecko.com/api/v3';

  constructor(options: ServiceOptions = {}) {
    this.demoMode = options.demoMode ?? (process.env['DEMO_MODE'] === 'true');
    this.apiKey = options.apiKey ?? process.env['COINGECKO_API_KEY'];
  }

  /**
   * Get global DeFi market data.
   */
  async getGlobalData(currency: string = 'usd'): Promise<DeFiStatsResponse> {
    if (this.demoMode) {
      const fixture = getDeFiStatsFixture(currency);
      return {
        provider: 'demo',
        currency,
        timestamp: fixture.timestamp,
        data: {
          total_market_cap: fixture.data.total_market_cap,
          total_volume_24h: fixture.data.total_volume_24h,
          market_cap_change_24h: fixture.data.market_cap_change_24h,
        },
      };
    }

    // Live API call
    const url = `${this.baseUrl}/global`;
    const headers: Record<string, string> = {};
    if (this.apiKey) {
      headers['x-cg-demo-api-key'] = this.apiKey;
    }

    try {
      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data: CoinGeckoGlobalData = await response.json();

      return {
        provider: 'coingecko',
        currency,
        timestamp: new Date().toISOString(),
        data: {
          total_market_cap: data.data.total_market_cap[currency] || 0,
          total_volume_24h: data.data.total_volume[currency] || 0,
          market_cap_change_24h: data.data.market_cap_change_percentage_24h_usd,
        },
      };
    } catch (error) {
      throw new Error(`Failed to fetch DeFi stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get top cryptocurrencies by market cap.
   */
  async getTopCoins(limit: number = 10, currency: string = 'usd'): Promise<CoinGeckoCoin[]> {
    if (this.demoMode) {
      const fixture = getDeFiStatsFixture(currency);
      return fixture.data.top_coins.slice(0, limit).map(coin => ({
        ...coin,
        market_cap_rank: 1,
        price_change_percentage_24h: coin.price_change_24h,
      }));
    }

    const url = `${this.baseUrl}/coins/markets?vs_currency=${currency}&order=market_cap_desc&per_page=${limit}&page=1`;
    const headers: Record<string, string> = {};
    if (this.apiKey) {
      headers['x-cg-demo-api-key'] = this.apiKey;
    }

    try {
      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Failed to fetch top coins: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export singleton instance
export const defiStatsService = new DeFiStatsService();