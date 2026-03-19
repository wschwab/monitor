/**
 * Monitor Backend Entry Point
 *
 * HTTP server + WebSocket for real-time task updates.
 * Coordinates agent execution, tool calls, and spend tracking.
 */

import { createServer } from 'http';

const PORT = process.env['PORT'] || 3001;

// Placeholder server - will be replaced with full implementation
const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', service: 'monitor-backend' }));
});

server.listen(PORT, () => {
  console.log(`Monitor backend running on port ${PORT}`);
});

export { server };