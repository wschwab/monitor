import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeFiStatsService } from './defi-stats';

describe('DeFiStatsService', () => {
  let service: DeFiStatsService;

  beforeEach(() => {
    service = new DeFiStatsService();
  });

  describe('getGlobalData', () => {
    it('should return global DeFi market data', async () => {
      const demoService = new DeFiStatsService({ demoMode: true });
      const response = await demoService.getGlobalData();

      expect(response).toBeDefined();
      expect(response.data).toBeDefined();
      expect(response.data.total_market_cap).toBeDefined();
      expect(response.data.total_volume_24h).toBeDefined();
      expect(response.data.market_cap_change_24h).toBeDefined();
    });

    it('should support different currencies', async () => {
      const demoService = new DeFiStatsService({ demoMode: true });
      const usdData = await demoService.getGlobalData('usd');
      const eurData = await demoService.getGlobalData('eur');

      expect(usdData.data).toBeDefined();
      expect(eurData.data).toBeDefined();
      expect(usdData.currency).toBe('usd');
      expect(eurData.currency).toBe('eur');
      expect(usdData.data.total_market_cap).not.toBe(eurData.data.total_market_cap);
    });

    it('should return fixture data in demo mode', async () => {
      const demoService = new DeFiStatsService({ demoMode: true });
      const response = await demoService.getGlobalData();

      expect(response.provider).toBe('demo');
      expect(response.data.total_market_cap).toBeGreaterThan(0);
    });

    it('should handle API errors gracefully', async () => {
      // Create service without demo mode to test error handling
      const liveService = new DeFiStatsService({ demoMode: false });
      
      // Mock fetch to simulate error
      global.fetch = vi.fn().mockRejectedValue(new Error('API Error'));

      await expect(liveService.getGlobalData()).rejects.toThrow('Failed to fetch DeFi stats');
    });
  });

  describe('getTopCoins', () => {
    it('should return top cryptocurrencies', async () => {
      const demoService = new DeFiStatsService({ demoMode: true });
      const coins = await demoService.getTopCoins(5);

      expect(coins).toBeInstanceOf(Array);
      expect(coins.length).toBeLessThanOrEqual(5);
    });

    it('should include coin details', async () => {
      const demoService = new DeFiStatsService({ demoMode: true });
      const coins = await demoService.getTopCoins(1);

      if (coins.length > 0) {
        expect(coins[0].id).toBeDefined();
        expect(coins[0].symbol).toBeDefined();
        expect(coins[0].current_price).toBeDefined();
      }
    });
  });
});