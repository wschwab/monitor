/**
 * Monitor Data Proxy
 *
 * mppx/proxy-compatible service for wrapped APIs and premium sources.
 * Implements /discover and /llms.txt for provider discovery.
 */

import { createServer } from 'http';

const PORT = process.env['PORT'] || 3002;

// Placeholder discovery endpoint
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

const server = createServer((req, res) => {
  if (req.url === '/discover' || req.url === '/llms.txt') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(DISCOVER_RESPONSE, null, 2));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`Monitor data proxy running on port ${PORT}`);
});

export { server };