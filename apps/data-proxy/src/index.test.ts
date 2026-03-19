import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { buildApp } from './index';

describe('data-proxy', () => {
  let app: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    app = buildApp({ demoMode: true });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // ===========================================================================
  // Discovery Endpoints
  // ===========================================================================

  describe('GET /discover', () => {
    it('should return service discovery info', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/discover',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.name).toBe('monitor-data-proxy');
      expect(body.version).toBeDefined();
      expect(body.providers).toBeInstanceOf(Array);
    });

    it('should include defi-stats provider', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/discover',
      });

      const body = JSON.parse(response.payload);
      const defiStats = body.providers.find((p: any) => p.id === 'defi-stats');
      expect(defiStats).toBeDefined();
      expect(defiStats.type).toBe('wrapped');
      expect(defiStats.description).toContain('DeFi');
    });

    it('should include news provider', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/discover',
      });

      const body = JSON.parse(response.payload);
      const news = body.providers.find((p: any) => p.id === 'news');
      expect(news).toBeDefined();
      expect(news.type).toBe('wrapped');
    });

    it('should include premium providers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/discover',
      });

      const body = JSON.parse(response.payload);
      expect(body.providers.some((p: any) => p.id === 'cern-temporal')).toBe(true);
      expect(body.providers.some((p: any) => p.id === 'cia-declassified')).toBe(true);
    });
  });

  describe('GET /llms.txt', () => {
    it('should return LLM-compatible service description', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/llms.txt',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.payload).toContain('monitor-data-proxy');
    });
  });

  // ===========================================================================
  // DeFi Stats Endpoint
  // ===========================================================================

  describe('GET /defi-stats', () => {
    it('should return DeFi statistics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/defi-stats',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.provider).toBe('demo'); // Demo mode returns 'demo'
      expect(body.data).toBeDefined();
    });

    it('should include market data fields', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/defi-stats',
      });

      const body = JSON.parse(response.payload);
      expect(body.data.total_market_cap).toBeDefined();
      expect(body.data.total_volume_24h).toBeDefined();
      expect(body.data.market_cap_change_24h).toBeDefined();
    });

    it('should handle query parameters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/defi-stats?currency=eur',
      });

      expect(response.statusCode).toBe(200);
    });
  });

  // ===========================================================================
  // Demo Mode
  // ===========================================================================

  describe('Demo Mode', () => {
    it('should return fixture data when DEMO_MODE=true', async () => {
      // Create app with demo mode enabled
      const demoApp = buildApp({ demoMode: true });
      await demoApp.ready();

      const response = await demoApp.inject({
        method: 'GET',
        url: '/defi-stats',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.demo).toBe(true);
      expect(body.data.total_market_cap).toBeDefined();

      await demoApp.close();
    });

    it('should not call external API in demo mode', async () => {
      const demoApp = buildApp({ demoMode: true });
      await demoApp.ready();

      const response = await demoApp.inject({
        method: 'GET',
        url: '/defi-stats',
      });

      const body = JSON.parse(response.payload);
      // Fixture data should be deterministic
      expect(body.data.total_market_cap).toBeGreaterThan(0);
      expect(body.timestamp).toBeDefined();

      await demoApp.close();
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/unknown-route',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error).toBeDefined();
    });

    it('should handle health check', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.status).toBe('ok');
    });
  });
});