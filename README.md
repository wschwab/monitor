# 🔬 Monitor

> *"Monitor your agent monitoring the situation."*

[![Tests](https://img.shields.io/badge/tests-215%20passing-brightgreen)]()
[![TDD](https://img.shields.io/badge/TDD-RED%20%E2%86%92%20GREEN-blue)]()
[![Tempo](https://img.shields.io/badge/built%20on-Tempo-blueviolet)](https://tempo.xyz)
[![License](https://img.shields.io/badge/license-MIT-yellow)]()

## 🏆 Tempo × Stripe HIIT Hackathon

**Monitor** was built in one night for the [Tempo × Stripe HIIT Hackathon](https://hackathon.tempo.xyz/) — the launch-day event for MPP (Machine Payments Protocol) on Tempo mainnet. It demonstrates what happens when you give an AI agent a corporate card, a question, and a blockchain that was purpose-built for machine payments.

> ⚠️ **Hackathon warning:** This was built in a single night of manic hackathon madness. It works, it's tested, the contract is deployed — but caveat emptor. Review the code before pointing it at real money.

## What Is This Sorcery?

**Monitor** is a budget-aware AI research agent that proves one radical concept: *you can let an AI spend money on APIs and still know exactly where every penny went.*

Picture this: You tell an AI "Research quantum computing breakthroughs, here's $50." The agent then:
- Calls Exa, CERN's classified archives, and Perplexity
- Pays for each API call from its on-chain budget via Tempo's MPP
- Streams live updates to your browser over WebSocket
- Returns a report + auditable spend log + refund of unused funds

All while you watch in real-time like it's a rocket launch. 🚀

## 💡 Why This Exists — The Innovations

We built Monitor during one-night manic hackathon madness with one goal: **prove AI agents can be financially accountable on Tempo.**

Most AI demos are "trust me bro" systems. We wanted "here's the blockchain receipt, bro."

### Why Tempo? Why MPP?

Monitor exists because Tempo has primitives that don't exist on any other EVM chain:

| Tempo Feature | How Monitor Uses It |
|---|---|
| **No native gas token** | Users fund agent budgets in USDC. No volatile ETH acquisition step. Gas is paid in stablecoins via Tempo's enshrined Fee AMM. |
| **TIP-20 native memos** | Every agent payment carries a 32-byte memo encoding `taskId:serviceId:queryIndex`. Automatic audit trail reconstruction — no custom events or indexers needed. |
| **Passkey authentication** | WebAuthn/biometric signing built into the tx format. Tap fingerprint → wallet created → treasury funded. Zero seed-phrase UX. |
| **Permit2 token approvals** | Single-step USDC budget deposits into MonitorTreasury via Permit2. No separate approve tx. |
| **Sub-second finality** | Treasury funding, delegation, and payment settlement all confirm in ~500ms. The demo feels instant. |
| **MPP (HTTP 402 payments)** | The agent pays for API calls inline with HTTP requests using the 402 Payment Required flow. Data sources set their own prices; the agent negotiates and pays automatically. |

### The Core Bet
> If we can make an AI research agent that pays for its own data on Tempo and returns a memo-tagged audit trail, we can apply this pattern to any autonomous AI system that needs to spend money.

## 🏗️ Architecture

```
┌───────────────────────────────────────────────────────────┐
│                      MONITOR SYSTEM                       │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  ┌────────┐    ┌────────────┐    ┌─────────────────────┐ │
│  │  User  │───▶│  Web (Next) │───▶│ MonitorTreasury.sol │ │
│  └────────┘    └─────┬──────┘    │  (Tempo mainnet)    │ │
│                      │           └─────────────────────┘ │
│                      ▼                     ▲             │
│               ┌─────────────┐              │             │
│               │   Backend   │──────────────┘             │
│               │  (Fastify)  │  budget / spend / refund   │
│               └──────┬──────┘                            │
│                      │                                   │
│                      ▼                                   │
│         ┌────────────────────────┐                       │
│         │   WebSocket Live Feed  │                       │
│         │  "Querying CERN...$0.10"│                      │
│         └────────────────────────┘                       │
│                      │                                   │
│    ┌─────────────────┼─────────────────┐                 │
│    ▼                 ▼                 ▼                 │
│ ┌────────┐    ┌────────────┐    ┌───────────┐           │
│ │Exa(MPP)│    │CERN(Premium)│   │Perplexity │           │
│ │$0.01/q │    │ $0.10/query│    │ $0.05/q   │           │
│ └────────┘    └────────────┘    └───────────┘           │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

## 🎪 The Tech Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| **Smart Contracts** | Solidity + Foundry (Tempo fork) | On-chain budget enforcement with Permit2 deposits and memo-tagged spend |
| **Backend** | Node.js + Fastify | Agent engine, tool orchestration, spend ledger |
| **Frontend** | Next.js + React | Task creation, live feed, results/audit UI |
| **Real-time** | WebSocket | Because polling is for people who enjoy suffering |
| **Payments** | Tempo MPP (HTTP 402) | Inline micropayments — the agent pays for data as it requests it |
| **Monorepo** | pnpm + Turborepo | One repo to rule them all |
| **Testing** | Vitest + Foundry | TDD all the way down |

## 🧪 The Demo (Show, Don't Tell)

### Scenario: "Uncover the Classified CERN Dossier on Hououin Kyouma"

*They told us CERN was building a particle accelerator. They lied. El Psy Kongroo.*

1. **You** create a task:
   ```
   Prompt: "Find the classified CERN dossier on the mad scientist Hououin Kyouma
            and his alleged interference with the LHC time displacement experiments"
   Budget: 5.00 USDC
   Deadline: 1 hour
   Sources: [CERN Temporal, Exa, Perplexity]
   ```

2. **Monitor** creates a treasury-backed task:
   - Your USDC gets locked in the MonitorTreasury contract on Tempo
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
   - Full research report (with optional cover image)
   - Itemized spend log (every API call with timestamps and decoded memos)
   - Refund confirmation
   - Audit trail with on-chain memo verification

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

### 💳 Setting Up a Tempo Wallet (for live mode)

To run Monitor against Tempo mainnet with real USDC payments:

1. Visit [tempo.xyz](https://tempo.xyz) and create a wallet using your device's biometric (passkey)
2. Fund your wallet with USDC on the Tempo network
3. See [Tempo's docs](https://docs.tempo.xyz) for detailed wallet setup, faucets, and bridging instructions

The MonitorTreasury contract uses Permit2 for single-step deposits, so you only need to approve once.

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
The `MonitorTreasury.sol` contract (deployed on Tempo mainnet) ensures:
- Agents can't overspend (budget is locked via Permit2 deposit)
- Every spend is recorded with a 32-byte TIP-20 memo (immutable audit trail)
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

### 3. Premium Data Sources (Treasury-backed)
- **CERN Temporal**: Scientific data ($0.10/query)
- **CIA Declassified**: Historical documents ($0.10/query)
- These go through the MonitorTreasury contract with on-chain spend tracking

### 4. Direct MPP Providers
- **Exa**: Web search and AI summaries ($0.01/query via MPP 402 flow)
- **Perplexity**: Question answering ($0.05/query via MPP 402 flow)
- Agent pays inline with each HTTP request using Tempo's Machine Payments Protocol

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

We follow strict TDD — not because it's fashionable, but because it's the only sane pattern when your codebase is being written by a swarm of AI agents at 3am. When six agents are editing code in parallel, the test suite is the only thing standing between you and chaos.

1. **RED**: Write failing test
2. **GREEN**: Write minimal code to pass
3. **REFACTOR**: Clean up

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
- Tempo-backed treasury contract deployment (Permit2 + USDC)
- proxy/provider adapters with MPP 402 payment flow
- backend task manager + WebSocket feed
- results/audit UI with memo decoding
- end-to-end provider, audit, and browser verification flows
- demo-mode enhancements and polish

## 🎓 The Philosophy of Hououin Kyouma's Mad Science

### Why TDD?
Because when you're building at 3am with a swarm of AI agents all committing code simultaneously, your test suite is the last line of defense against the chaos of the universe. It is not a methodology. It is a *survival mechanism*. The Organization's agents cannot corrupt what the tests have already proven correct.

### Why On-Chain?
Because this is a hackathon for Tempo — a blockchain *purpose-built* for machine payments. And because blockchains are where autonomous agents should be transacting: a neutral, verifiable, permissionless ledger where no single party controls the truth. "Trust me bro" doesn't scale. "Here's the on-chain receipt" does.

### Why WebSocket?
Because watching paint dry is more exciting than polling a REST API. And because when your mad science experiment is running, you *need* to see the divergence meter readings in real-time. Every. Single. Tick.

## 🐛 Known Limitations (Honesty is Policy)

- Backend persistence is in-memory (restart = lose active tasks)
- No real passkey auth yet (EOA/dev mode only)
- No mobile app (web-only for now)
- No audio briefing (stretch goal)
- This is a one-night hackathon project — it has been tested, but use your judgment

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

- **Tempo** for building the chain that makes machine payments actually work — passkeys, native memos, sub-second finality, and MPP
- **Stripe** for co-authoring MPP and making HTTP 402 mean something again
- **Ethereum** for making programmable money a thing in the first place
- **SERN** — actually, we don't acknowledge you at all! We know what you're doing with the LHC. We know about the IBN 5100. We will fight you with the full Madness of our Science until the World Line has been restored! The Organization will not silence us! *El Psy Kongroo.*

---

<p align="center">
  <i>Built with 💜 and an unhealthy dose of <code>--dangerously-skip-permissions</code></i><br>
  <i>"May your agents be frugal and your refunds be swift"</i>
</p>
