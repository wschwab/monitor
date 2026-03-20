# 🔬 Monitor

> *"Monitor your agent monitoring the situation."*

[![Tests](https://img.shields.io/badge/tests-144%20passing-brightgreen)]()
[![TDD](https://img.shields.io/badge/TDD-RED%20%E2%86%92%20GREEN-blue)]()
[![License](https://img.shields.io/badge/license-MIT-yellow)]()

## What Is This Sorcery?

**Monitor** is a budget-aware AI research agent that proves one radical concept: *you can let an AI spend money on APIs and still know exactly where every penny went.*

Picture this: You tell an AI "Research quantum computing breakthroughs, here's $50." The agent then:
- Calls Exa, CERN's classified archives, and Perplexity
- Pays for each API call from its on-chain budget
- Streams live updates to your browser
- Returns a report + auditable spend log + refund of unused funds

All while you watch in real-time like it's a rocket launch. 🚀

## The Story (Why This Exists)

We built Monitor for a hackathon weekend with one goal: **prove AI agents can be financially accountable.**

Most AI demos are "trust me bro" systems. We wanted "here's the blockchain receipt, bro."

### The Core Bet
> If we can make an AI research agent that pays for its own data and returns an audit trail, we can apply this pattern to any autonomous AI system.

## 🏗️ Architecture (The Cool Stuff)

```
┌─────────────────────────────────────────────────────────────────┐
│                         MONITOR SYSTEM                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐     ┌──────────────┐     ┌─────────────────────┐ │
│  │   User   │────▶│  Web Frontend │────▶│  MonitorTreasury.sol│ │
│  └──────────┘     └──────────────┘     │   (Solidity Contract)│ │
│         │                    │          └─────────────────────┘ │
│         │                    │                   ▲              │
│         │                    ▼                   │              │
│         │            ┌──────────────┐            │              │
│         │            │   Backend    │────────────┘              │
│         │            │   (Node.js)  │   Budget/Spend            │
│         │            └──────────────┘                           │
│         │                    │                                  │
│         ▼                    ▼                                  │
│  ┌──────────────────────────────────────┐                      │
│  │         WebSocket Live Feed          │                      │
│  │  "Accessing CERN classified archive... $0.10" │             │
│  └──────────────────────────────────────┘                      │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Data Sources                          │   │
│  │  ┌────────────┐ ┌────────────┐ ┌─────────────────────┐ │   │
│  │  │ Exa (MPP)  │ │ CERN (Premium)│ │  Perplexity (MPP)  │ │   │
│  │  │ $0.01/query│ │ $0.10/query   │ │  $0.05/query       │ │   │
│  │  └────────────┘ └────────────┘ └─────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 🎪 The Tech Stack (No Boring Corporate Logos)

| Component | Technology | Why We Chose It |
|-----------|-----------|-----------------|
| **Smart Contracts** | Solidity + Foundry | Because blockchains are the ultimate receipt printers |
| **Backend** | Node.js + Fastify | Fast, typed, and doesn't judge our life choices |
| **Frontend** | Next.js + React | It works, and Vercel hosts it for free |
| **Real-time** | WebSocket | Because polling is for people who enjoy suffering |
| **Monorepo** | pnpm + Turborepo | One repo to rule them all |
| **Testing** | Vitest + Foundry | If it's not tested, it's broken |

## 🧪 The Demo (Show, Don't Tell)

### Scenario: "Uncover the Classified CERN Dossier on Hououin Kyouma"

*They told us CERN was building a particle accelerator. They lied. El Psy Kongroo.*

1. **You** create a task:
   ```
   Prompt: "Find the classified CERN dossier on the mad scientist Hououin Kyouma
            and his alleged interference with the LHC time displacement experiments"
   Budget: $5.00
   Deadline: 1 hour
   Sources: [CERN Temporal, Exa, Perplexity]
   ```

2. **Monitor** creates a treasury-backed task:
   - Your $5 gets locked in the MonitorTreasury contract
   - The agent gets permission to spend up to that amount

3. **Live Execution** (you watch in real-time):
   ```
   [14:32:01] 🔍 Accessing CERN classified archive... $0.10
   [14:32:04] 📊 Retrieved dossier: Subject "Hououin Kyouma", threat level: DIVERGENT
   [14:32:08] 🔍 Querying Exa for corroborating evidence... $0.01
   [14:32:12] 🧠 Synthesizing report with LLM... $0.50
   [14:32:45] ✅ Report complete! Total spent: $0.61
   [14:32:46] 💰 Refunding $4.39 to your wallet
   ```

4. **Results Page**:
   - Full research report
   - Itemized spend log (every API call with timestamps)
   - Refund confirmation
   - Option to download or share

## 🚀 Run Monitor Locally

### Prerequisites
- Node.js 20+
- pnpm 9+
- A copy of `.env` (start from `.env.example`)

### 1) Install dependencies
```bash
git clone git@github.com:wschwab/monitor.git
cd monitor
pnpm install
cp .env.example .env
```

### 2) Pick a mode

**Fastest local/demo setup**
- Set `DEMO_MODE=true` in `.env`
- Leave `LLM_PROVIDER=mock`
- Local web runs with the dev funding bypass enabled by default, so you can exercise the full UI without a Tempo wallet popup

**Live/Tempo setup**
- Set `DEMO_MODE=false`
- Fill in `TEMPO_RPC_URL`
- Keep `TREASURY_ADDRESS=0x95c9009c82FEd445dEDeecEfC2abA6edEb920941`
- Add any provider keys you want to exercise (`EXA_API_KEY`, `CERN_API_KEY`, etc.)

### 3) Start the app
```bash
pnpm dev
```

That starts the local services on:
- Web UI: `http://localhost:3000`
- Backend API: `http://localhost:3001`
- WebSocket server: `ws://localhost:3002`
- Data proxy: `http://localhost:3003`

### 4) Use the app
1. Open `http://localhost:3000`
2. Create a task from the home page
3. On the live feed page, click **Use Dev Funding Bypass** (demo/local) or fund with Tempo wallet (live mode)
4. Wait for the task to complete
5. Open the results page to inspect the report, spend audit, refund, and any generated cover image

### Useful commands
```bash
# Run the full test suite
pnpm test

# Run the backend smoke flow directly
pnpm demo:smoke

# Start individual services instead of turbo
pnpm --filter @monitor/backend dev
pnpm --filter @monitor/web dev
pnpm --filter @monitor/data-proxy dev
```

## 🧩 Project Structure

```
monitor/
├── 📁 apps/
│   ├── backend/           # The brain (Node.js + WebSocket)
│   ├── web/               # The face (Next.js)
│   └── data-proxy/        # The middleman (Fastify)
│
├── 📁 packages/
│   └── shared/            # Types and constants everyone uses
│
├── 📁 contracts/
│   └── src/
│       └── MonitorTreasury.sol   # The on-chain accountant
│
├── 📁 .sisyphus/
│   ├── plans/             # Execution plans (we actually read these)
│   ├── evidence/          # TDD evidence (RED/GREEN files)
│   └── templates/         # TDD workflow template
│
└── 📁 .jat/
    └── memory/            # Agent memories (for future agents)
```

## 🎯 Key Features

### 1. On-Chain Budget Enforcement
The `MonitorTreasury.sol` contract ensures:
- Agents can't overspend (budget is locked in contract)
- Every spend is recorded on-chain (immutable audit trail)
- Unused budget is automatically refunded
- Deadlines are enforced (can't spend after expiry)

### 2. Real-Time WebSocket Feed
Watch your agent work in real-time:
```typescript
ws.on('message', (event) => {
  if (event.type === 'spend') {
    console.log(`💸 Spent $${event.amount} on ${event.service}`);
  }
});
```

### 3. Premium Data Sources
- **CERN Temporal**: Scientific data ($0.10/query)
- **CIA Declassified**: Historical documents ($0.10/query)
- These go through Treasury billing (not direct MPP)

### 4. Direct MPP Providers
- **Exa**: Web search and AI summaries ($0.01/query)
- **Perplexity**: Question answering ($0.05/query)
- These use direct MPP payment flow

### 5. Demo Mode
Demo mode returns deterministic fixtures for research, synthesis, and enhancement flows, so you can exercise the full product without spending real money.

```bash
# In .env
DEMO_MODE=true
LLM_PROVIDER=mock

# Then start normally
pnpm dev
```

## 🧪 Testing (We Actually Do This)

We follow strict TDD (Test-Driven Development):

1. **RED**: Write failing test
2. **GREEN**: Write minimal code to pass
3. **REFACTOR**: Clean up

Use the workspace scripts to validate everything:

```bash
# Run all tests
pnpm test

# Run specific package tests
pnpm test --filter @monitor/backend
pnpm test --filter @monitor/contracts

# Run with coverage
pnpm test --coverage
```

## 📊 MVP Status

The Monitor MVP task waves are complete, including:
- shared spend semantics and memo encoding
- Tempo-backed treasury contract deployment
- proxy/provider adapters
- backend task manager + WebSocket feed
- results/audit UI
- end-to-end provider, audit, and browser verification flows
- demo-mode enhancements and polish

## 🎓 The Philosophy

### Why TDD?
Because "I'll write tests later" is the biggest lie in software development.

### Why On-Chain?
Because "trust me bro" doesn't scale to real money.

### Why WebSocket?
Because watching paint dry is more exciting than polling a REST API.

## 🐛 Known Limitations (Honesty is Policy)

- Backend persistence is in-memory (restart = lose active tasks)
- No real passkey auth yet (EOA/dev mode only)
- No mobile app (web-only for now)
- No audio briefing (stretch goal)

## 🤝 Contributing

This is a hackathon project, but if you want to extend it:

1. Fork it
2. Create a feature branch (`jj branch create my-feature`)
3. Write tests first (TDD or bust)
4. Make it pass
5. Push and open a PR

## 📜 License

MIT - Do what you want, just don't blame us if your AI spends all your money on cat pictures.

## 🙏 Acknowledgments

- **CERN** for allegedly building a time machine and keeping detailed dossiers on mad scientists who interfere with it (we just wrap their API — the classified parts)
- **Ethereum** for making programmable money a thing
- **Coffee** for making this possible at 3am

---

<p align="center">
  <i>Built with 💜 and an unhealthy amount of caffeine</i><br>
  <i>"May your agents be frugal and your refunds be swift"</i>
</p>
