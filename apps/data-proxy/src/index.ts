/**
 * Monitor Data Proxy
 *
 * mppx/proxy-compatible service for wrapped APIs and premium sources.
 * Implements /discover and /llms.txt for provider discovery.
 */

import Fastify from 'fastify';
import { fileURLToPath } from 'node:url';
import { defiStatsService } from './services/defi-stats';
import { isDemoMode } from './demo-fixtures';

export interface AppOptions {
  demoMode?: boolean;
}

export function buildApp(options: AppOptions = {}) {
  const app = Fastify({
    logger: true,
  });

  const demoMode = options.demoMode ?? isDemoMode();

  // Override service with demo mode if specified
  if (demoMode) {
    defiStatsService['demoMode'] = true;
  }

  // =========================================================================
  // Discovery Routes
  // =========================================================================

  const DISCOVER_RESPONSE = {
    name: 'monitor-data-proxy',
    version: '0.1.0',
    providers: [
      { id: 'defi-stats', type: 'wrapped', description: 'DeFi statistics from CoinGecko' },
      { id: 'news', type: 'wrapped', description: 'News feed aggregation' },
      { id: 'cern-temporal', type: 'premium', description: 'CERN temporal data (Treasury-backed)' },
      { id: 'cia-declassified', type: 'premium', description: 'CIA declassified documents (Treasury-backed)' },
    ],
  };

  app.get('/discover', async () => {
    return DISCOVER_RESPONSE;
  });

  app.get('/llms.txt', async (request, reply) => {
    reply.header('content-type', 'text/plain');
    return `monitor-data-proxy
Version: 0.1.0

Available Providers:
- defi-stats: DeFi statistics from CoinGecko (wrapped)
- news: News feed aggregation (wrapped)
- cern-temporal: CERN temporal data (premium, Treasury-backed)
- cia-declassified: CIA declassified documents (premium, Treasury-backed)

Demo Mode: ${demoMode ? 'enabled' : 'disabled'}
`;
  });

  // =========================================================================
  // DeFi Stats Routes
  // =========================================================================

  app.get('/defi-stats', async (request) => {
    const { currency = 'usd' } = request.query as { currency?: string };
    
    const data = await defiStatsService.getGlobalData(currency);
    
    return {
      ...data,
      demo: demoMode || data.provider === 'demo',
    };
  });

  // =========================================================================
  // Health Check
  // =========================================================================

  app.get('/health', async () => {
    return { status: 'ok', demoMode };
  });

  return app;
}

// =========================================================================
// Server Startup (for direct execution)
// =========================================================================

const PORT = parseInt(process.env['PORT'] || '3003', 10);

async function main() {
  const app = buildApp();
  
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Monitor data proxy running on port ${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectExecution) {
  main();
}

export { defiStatsService };
export * from './demo-fixtures';
