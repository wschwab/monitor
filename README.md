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

## 🚀 Quick Start

```bash
# Clone (you already did this, smart person)
git clone git@github.com:wschwab/monitor.git
cd monitor

# Install dependencies
pnpm install

# Run tests (all should pass, we have 144 of them)
pnpm test

# Start development servers
pnpm dev

# The backend runs on :3001, frontend on :3000, proxy on :3002
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
Run without spending real money:
```bash
DEMO_MODE=true pnpm dev
```
All API calls return deterministic fixtures. Perfect for development and testing.

## 🧪 Testing (We Actually Do This)

We follow strict TDD (Test-Driven Development):

1. **RED**: Write failing test
2. **GREEN**: Write minimal code to pass
3. **REFACTOR**: Clean up

Current test count: **144 tests passing**

```bash
# Run all tests
pnpm test

# Run specific package tests
pnpm test --filter @monitor/backend
pnpm test --filter @monitor/contracts

# Run with coverage
pnpm test --coverage
```

## 📊 Task Waves

| Wave | Task | Status |
|------|------|--------|
| 0 | Workspace setup | ✅ |
| 1 | Shared types & spend semantics | ✅ |
| 2 | MonitorTreasury contract | ✅ |
| 3 | Proxy + Premium providers | ✅ |
| 4 | **Task manager + WebSocket** | 🔄 |
| 5 | Real MPP adapters | ⏳ |
| 6 | Frontend UI | ⏳ |
| 7 | Polish + Demo mode | ⏳ |

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
