/**
 * Demo Fixtures
 *
 * Deterministic fixture data for offline/demo mode.
 * Returns consistent results without external API calls.
 */

export interface DeFiStatsFixture {
  demo: true;
  timestamp: string;
  data: {
    total_market_cap: number;
    total_volume_24h: number;
    market_cap_change_24h: number;
    top_coins: Array<{
      id: string;
      symbol: string;
      name: string;
      current_price: number;
      market_cap: number;
      price_change_24h: number;
    }>;
  };
}

/**
 * Get deterministic DeFi stats fixture.
 */
export function getDeFiStatsFixture(currency: string = 'usd'): DeFiStatsFixture {
  const baseValues: Record<string, number> = {
    usd: 2500000000000, // $2.5T
    eur: 2300000000000,
    gbp: 1950000000000,
  };

  const marketCap = baseValues[currency.toLowerCase()] || baseValues.usd;

  return {
    demo: true,
    timestamp: new Date().toISOString(),
    data: {
      total_market_cap: marketCap,
      total_volume_24h: marketCap * 0.05, // 5% daily volume
      market_cap_change_24h: 2.5, // +2.5%
      top_coins: [
        {
          id: 'bitcoin',
          symbol: 'btc',
          name: 'Bitcoin',
          current_price: currency === 'usd' ? 65000 : currency === 'eur' ? 60000 : 51000,
          market_cap: marketCap * 0.52,
          price_change_24h: 1.8,
        },
        {
          id: 'ethereum',
          symbol: 'eth',
          name: 'Ethereum',
          current_price: currency === 'usd' ? 3500 : currency === 'eur' ? 3200 : 2700,
          market_cap: marketCap * 0.18,
          price_change_24h: 3.2,
        },
        {
          id: 'solana',
          symbol: 'sol',
          name: 'Solana',
          current_price: currency === 'usd' ? 145 : currency === 'eur' ? 133 : 113,
          market_cap: marketCap * 0.025,
          price_change_24h: 5.7,
        },
      ],
    },
  };
}

/**
 * Check if demo mode is enabled via environment.
 */
export function isDemoMode(): boolean {
  return process.env['DEMO_MODE'] === 'true';
}
