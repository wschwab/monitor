---
task: monitor-uefax
agent: Sisyphus
project: monitor
completed: 2026-03-19
files:
  - apps/data-proxy/src/index.ts
  - apps/data-proxy/src/index.test.ts
  - apps/data-proxy/src/services/defi-stats.ts
  - apps/data-proxy/src/services/defi-stats.test.ts
  - apps/data-proxy/src/demo-fixtures.ts
  - .sisyphus/evidence/monitor-uefax-red.txt
  - .sisyphus/evidence/monitor-uefax-green.txt
tags:
  - fastify
  - proxy
  - tdd
  - demo-mode
  - coingecko
labels:
  - wave-3
  - tdd-compliant
priority: P2
type: task
---

# Build Proxy Foundation with Wrapped Real Source and Demo-Mode Fixtures

## Summary

Implemented data-proxy service with Fastify, providing wrapped CoinGecko API and deterministic demo fixtures for offline development.

## TDD Workflow

### RED Phase
- Wrote 18 failing tests for /discover, /llms.txt, /defi-stats endpoints
- Tests failed: buildApp not exported, defi-stats module missing
- Evidence saved to monitor-uefax-red.txt

### GREEN Phase
- Implemented Fastify app with all endpoints
- Created DeFiStatsService with CoinGecko wrapper
- Added demo-fixtures.ts for deterministic data
- All 18 tests passed
- Evidence saved to monitor-uefax-green.txt

## API Endpoints

### GET /discover
Service discovery returning all available providers (wrapped and premium).

### GET /llms.txt
LLM-compatible text description of the service.

### GET /defi-stats?currency=usd
DeFi market data from CoinGecko (live) or fixtures (demo mode).

### GET /health
Health check with demo mode status.

## Demo Mode

Set `DEMO_MODE=true` to enable fixture responses:
- No external API calls
- Deterministic data ($2.5T market cap, BTC/ETH/SOL prices)
- No rate limits
- Fast responses

## DeFiStatsService

```typescript
class DeFiStatsService {
  getGlobalData(currency: string): Promise<DeFiStatsResponse>
  getTopCoins(limit: number, currency: string): Promise<CoinGeckoCoin[]>
}
```

Supports both live API and demo fixture modes.

## Fixtures

Deterministic mock data:
- Total market cap: $2.5T USD
- 24h volume: 5% of market cap
- Market change: +2.5%
- Top coins: BTC ($65k), ETH ($3.5k), SOL ($145)

## Test Count

- data-proxy: 18 tests
- shared: 44 tests
- backend: 41 tests
- web: 1 test
- contracts: 25 tests
- **Total: 129 tests passing**

## Next Steps

Task 6 (monitor-ewxd9) - Build premium mock provider seam:
- Create cern-temporal and cia-declassified premium providers
- Integrate with MonitorTreasury for billing
- Add premium-executor in backend