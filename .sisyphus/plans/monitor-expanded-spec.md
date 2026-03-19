# MONITOR — Expanded Hackathon Spec (Agent-Buildable)

> "Monitoring the situation."
>
> Delegate a research task to an AI agent. Give it an allowance. It pays for the answers.
> **Every penny — even the thinking — is on the receipt.**

---

## 1. Project Summary

Monitor is a research-agent delegation platform built on Tempo and MPP. A user describes a research task, sets a stablecoin budget, and hands it off to an AI agent. The agent autonomously discovers and pays for data sources using MPP (the Machine Payments Protocol) — including **its own LLM inference**. It compiles findings into a rich research report complete with a cover image, an optional audio briefing, and a full memo-tagged spend audit trail.

The pitch: **"Give your AI analyst a corporate card and a question. Get back the answer, the receipt, and the change."**

### What Makes This Special

1. **The agent pays for EVERYTHING via MPP** — data queries, its own LLM reasoning, image generation, report hosting, email delivery. The audit trail captures every cent.
2. **Real services, real money** — Not mock APIs. The agent queries Exa, Allium, Perplexity, and more — live production services accepting MPP payments today.
3. **Dual payment model** — Commodity data via direct MPP payments. Premium/licensed data via Monitor's Treasury proxy (shared subscription access). Like a corporate card with both a personal limit and company accounts.
4. **Fictional premium sources** — CERN Temporal Research API and CIA Declassified Intelligence API as mock "licensed" sources behind Monitor's Treasury. Because why not.
5. **Full audit trail** — Every TIP-20 transfer carries a 32-byte memo encoding `taskId:serviceId:queryIndex`. Zero custom events or indexers needed.

---

## 2. Why Tempo / Why MPP — Standout Features to Exploit

This section documents every Tempo-native primitive that makes Monitor possible. These features do not exist on any other EVM chain and are the reason this project cannot be built on Arbitrum, Base, or Optimism.

### 2.1 Tempo Protocol Primitives

| Feature | What it is | How Monitor uses it |
|---|---|---|
| **No native token** | Gas is paid in any USD-denominated TIP-20 stablecoin via an enshrined Fee AMM. No ETH dependency. Fixed base fee targeting <$0.001/transfer. | Users fund agent wallets in pathUSD/USDC. No volatile gas token acquisition step. |
| **TIP-20 tokens** | Enshrined ERC-20 implemented as precompiles (not user-deployed bytecode). Native 32-byte transfer memos, ISO 4217 currency codes, shared compliance registry (TIP-403), built-in reward distribution. | Every agent payment carries a memo encoding `taskId:serviceId:queryIndex` for automatic audit trail reconstruction. No custom events or indexers needed. |
| **Tempo Transactions (type 0x76)** | A single tx type packing: passkey/WebAuthn signing, call batching, fee sponsorship, 2D nonces, expiring nonces, and access key delegation. | See individual rows below. |
| **Passkey authentication** | WebAuthn/biometric signing built into the tx format. No smart contract wallets, no browser extensions. | User onboarding: tap fingerprint → wallet created → treasury funded. Zero seed-phrase UX. |
| **Call batching** | Atomic multi-operation transactions. | `fundTreasury + delegateKey + startTask` in a single tx. |
| **Fee sponsorship** | A third party co-signs to pay gas on behalf of the sender. | The Monitor platform sponsors gas for agent operations so the agent's entire budget goes to data, not fees. |
| **2D nonces** | Parallel nonce lanes enabling concurrent tx submission without serial blocking. | Agent opens multiple MPP Sessions simultaneously on different nonce lanes — querying 3 data sources in parallel, not sequentially. |
| **Expiring nonces** | Time-bounded tx validity via `valid_before`/`valid_after` fields. | Agent key delegation expires when the task deadline passes. Automatic security boundary. |
| **Access key delegation** | Authorize specific keys with spending limits, contract allowlists, and expiry. | User delegates a scoped key to the agent: "spend up to X pathUSD, only on these services, expires in 2 hours." |
| **Payment lanes** | Reserved blockspace for TIP-20 transfers ensuring predictable execution during congestion. | Agent payments settle reliably even if Tempo is under load during the hackathon demo. |
| **Enshrined stablecoin DEX** | Protocol-level precompile with anti-MEV properties (fixed-rate fees, no sandwich attacks). | If agent needs to swap between stablecoins to pay a provider, it uses the enshrined DEX with guaranteed fair execution. |
| **Sub-second finality** | ~500ms deterministic finality via Simplex BFT consensus. | Treasury funding, delegation, and payment settlement all confirm in under a second. Demo feels instant. |

### 2.2 MPP (Machine Payments Protocol)

MPP is an HTTP-native payment protocol co-authored by Tempo and Stripe. It uses the HTTP 402 status code to negotiate payments inline with API requests.

**Core flow:**
1. Client requests a resource → server responds `402 Payment Required` with pricing + accepted payment methods in headers
2. Client constructs payment proof → retries request with `Authorization: Payment <proof>` header
3. Server verifies payment → returns the resource with a `Payment-Receipt` header

**Two payment intents:**

| Intent | Mechanism | Latency | Monitor use case |
|---|---|---|---|
| **Charge** | One-time on-chain TIP-20 transfer with memo. ~500ms (1 block). | Per-block | Initial setup payments, one-off premium data access |
| **Session** | Client locks funds in an on-chain escrow contract (`TempoStreamChannel`). Subsequent requests use signed off-chain vouchers verified via pure CPU. Thousands of requests per session, near-zero marginal latency. | ~0ms per request after setup | **Primary pattern.** Agent opens a Session with each data source and issues micropenny vouchers per query. |

**Session lifecycle (TempoStreamChannel escrow):**
1. Client deposits funds into escrow → gets a `channelId`
2. Client signs EIP-712 vouchers with increasing cumulative amounts per request
3. Server verifies voucher signature (CPU-only, no RPC) → returns data
4. Top-up: client deposits more without closing channel
5. Close: either party calls `close()` → final settlement on-chain, remainder refunded

**Escrow contract addresses:**
- **Mainnet** (chain ID 4217): `0x33b901018174DDabE4841042ab76ba85D4e24f25`
- **Testnet Moderato** (chain ID 42431): `0xe1c4d3dce17bc111181ddf716f75bae49e61a336`

**TIP-20 token addresses:**
- **pathUSD**: `0x20c0000000000000000000000000000000000000`
- **USDC**: Check `docs.tempo.xyz/protocol/tip20/spec` for current address

**MCP Transport (stretch goal):**
MPP also has an MCP transport binding for AI tool calls:
- Challenge: JSON-RPC error code `-32042`
- Credential: `_meta.org.paymentauth/credential`
- Receipt: `_meta.org.paymentauth/receipt`
This would allow the agent's tool calls to natively handle payment challenges inline with MCP.

**SDK ecosystem:**
- TypeScript: `mppx` (client + server + proxy), framework middleware (`@mppx/next`, `@mppx/hono`, `@mppx/express`, `@mppx/elysia`)
- Python: `pympp`
- Rust: `mpp-rs`
- CLI: `tempo wallet` / `tempo request` for agent consumption

**MPP discovery:** Servers expose `/.well-known/mpp.json` with pricing, accepted payment methods, and session configuration. The `mppx/proxy` auto-generates this.

---

## 3. Architecture — Dual Payment Model

Monitor uses two payment patterns depending on the data source type:

### 3.1 Payment Architecture Overview

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                           USER (passkey wallet)                                │
│  Funds agent wallet via batched 0x76 tx:                                       │
│    fund + delegate access key + set budget/deadline                            │
└───────────────┬───────────────────────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                         MONITOR BACKEND                                        │
│                                                                                │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │                    AGENT ENGINE (Node.js + TypeScript)                    │  │
│  │                                                                          │  │
│  │  ┌─────────────────┐   ┌─────────────────┐   ┌──────────────────────┐   │  │
│  │  │  LLM Orchestrator│   │  mppx Client    │   │  Treasury Client    │   │  │
│  │  │  (Claude/GPT via │   │  (direct MPP    │   │  (spend() for      │   │  │
│  │  │   MPP! Pays for  │   │   402 payments) │   │   premium/licensed │   │  │
│  │  │   own inference) │   │                 │   │   sources)         │   │  │
│  │  └────────┬─────────┘   └────────┬────────┘   └────────┬───────────┘   │  │
│  │           │                      │                      │               │  │
│  └───────────┼──────────────────────┼──────────────────────┼───────────────┘  │
│              │                      │                      │                   │
│  ┌───────────▼──────────┐           │           ┌──────────▼───────────────┐   │
│  │  Fee Sponsor         │           │           │  MonitorTreasury.sol     │   │
│  │  (co-signs agent txs │           │           │  (budget, delegation,    │   │
│  │   to cover gas)      │           │           │   premium source proxy)  │   │
│  └──────────────────────┘           │           └──────────────────────────┘   │
└─────────────────────────────────────┼─────────────────────────────────────────┘
                                      │
                ┌─────────────────────┼──────────────────────────┐
                │                     │                          │
                ▼                     ▼                          ▼
┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────────┐
│  REAL MPP SERVICES   │ │  PROXY-WRAPPED APIs  │ │  PREMIUM MOCK SOURCES    │
│  (direct payment)    │ │  (mppx/proxy)        │ │  (Treasury-proxied)      │
│                      │ │                      │ │                          │
│  • Exa (web search)  │ │  • CoinGecko DeFi   │ │  • CERN Temporal Research│
│  • Allium (on-chain) │ │    stats proxy       │ │    (Steins;Gate data)    │
│  • Perplexity (AI)   │ │  • News API proxy    │ │  • CIA Declassified Intel│
│  • Anthropic (LLM)   │ │                      │ │    (UFO/paranormal data) │
│  • OpenAI (LLM+TTS)  │ │  Auto-serves:        │ │                          │
│  • fal.ai (images)   │ │  /discover, /llms.txt│ │  Behind mppx/proxy with  │
│  • StableUpload      │ │  /.well-known/mpp.json│ │  Treasury.spend() for   │
│  • StableEmail       │ │                      │ │  payment (not direct MPP)│
└──────────────────────┘ └──────────────────────┘ └──────────────────────────┘
```

### 3.2 Payment Flow: Direct MPP (Commodity Sources)

For services already on MPP (Exa, Allium, Anthropic, etc.):
1. Agent's `mppx` client sends request
2. Service responds `402 Payment Required` with challenge
3. `mppx` client auto-constructs payment proof (Charge or Session voucher)
4. Service verifies payment → returns data
5. Payment tagged with TIP-20 memo for audit trail

The agent pays directly from its delegated access key (spending cap enforced at protocol level).

### 3.3 Payment Flow: Treasury Proxy (Premium/Licensed Sources)

For sources where Monitor holds an expensive subscription (CERN, CIA mock APIs):
1. Agent calls Monitor's internal premium proxy endpoint
2. Proxy calls `Treasury.spend()` to debit the task budget
3. Monitor uses its subscription credentials to fetch data from the premium source
4. Data returned to agent, spend logged with memo

This is the "shared corporate card" pattern — Monitor aggregates licensing costs and resells per-query access.

### 3.4 MonitorTreasury.sol

A smart contract acting as a **scoped, auditable wallet for AI agents** + **premium source payment proxy**.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// NOTE: TIP-20 tokens are precompiles on Tempo, not standard ERC-20.
// Use Tempo's viem extensions or the TIP-20 precompile interface.
// Adapt to actual Tempo precompile ABI from docs.tempo.xyz/protocol/tip20/spec

interface ITIP20 {
    function transferWithMemo(address to, uint256 amount, bytes32 memo) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

contract MonitorTreasury {

    // --- Types ---

    struct Task {
        address owner;           // passkey-authed user address
        address agentKey;        // delegated agent key
        address token;           // TIP-20 stablecoin (pathUSD/USDC)
        uint256 budget;          // max spend
        uint256 spent;           // running total
        uint256 deadline;        // unix timestamp — key expires here too
        bytes32 taskMemo;        // 32-byte task identifier
        bool active;
    }

    // --- State ---

    mapping(bytes32 => Task) public tasks;               // taskId => Task
    mapping(bytes32 => address[]) public allowedTargets;  // taskId => MPP provider allowlist
    mapping(bytes32 => SpendEntry[]) public spendLog;     // taskId => audit trail

    struct SpendEntry {
        address target;
        uint256 amount;
        bytes32 memo;      // encodes serviceId:queryIndex
        uint256 timestamp;
    }

    // --- Events ---

    event TaskCreated(bytes32 indexed taskId, address indexed owner, uint256 budget, uint256 deadline);
    event Spend(bytes32 indexed taskId, address indexed target, uint256 amount, bytes32 memo);
    event TaskClosed(bytes32 indexed taskId, uint256 spent, uint256 refunded);

    // --- Core Functions ---

    /// @notice Create and fund a research task.
    /// @dev In production, this is called via a batched 0x76 tx that also sets up
    ///      access key delegation at the protocol level.
    ///      User MUST approve this contract to spend `budget` of `token` before calling.
    function createTask(
        bytes32 taskId,
        address agentKey,
        address token,
        uint256 budget,
        uint256 deadline,
        bytes32 taskMemo,
        address[] calldata targets
    ) external {
        require(tasks[taskId].owner == address(0), "task exists");
        require(deadline > block.timestamp, "deadline passed");
        require(budget > 0, "zero budget");

        // Transfer budget from user to this contract
        // NOTE: User must have called token.approve(thisContract, budget) first
        // In a batched 0x76 tx, the approve + createTask happen atomically
        require(
            ITIP20(token).transferFrom(msg.sender, address(this), budget),
            "transfer failed"
        );

        tasks[taskId] = Task({
            owner: msg.sender,
            agentKey: agentKey,
            token: token,
            budget: budget,
            spent: 0,
            deadline: deadline,
            taskMemo: taskMemo,
            active: true
        });

        for (uint i = 0; i < targets.length; i++) {
            allowedTargets[taskId].push(targets[i]);
        }

        emit TaskCreated(taskId, msg.sender, budget, deadline);
    }

    /// @notice Agent spends from the task budget (for premium/licensed sources).
    /// @dev For direct MPP payments, the agent pays services directly via its
    ///      delegated access key — those don't go through this function.
    ///      This function is ONLY for Treasury-proxied premium sources.
    function spend(
        bytes32 taskId,
        address to,
        uint256 amount,
        bytes32 memo
    ) external {
        Task storage task = tasks[taskId];
        require(task.active, "task inactive");
        require(msg.sender == task.agentKey, "not agent");
        require(block.timestamp < task.deadline, "expired");
        require(task.spent + amount <= task.budget, "over budget");
        require(_isAllowedTarget(taskId, to), "target not allowed");

        task.spent += amount;

        // TIP-20 transfer with memo — native Tempo feature
        ITIP20(task.token).transferWithMemo(to, amount, memo);

        spendLog[taskId].push(SpendEntry({
            target: to,
            amount: amount,
            memo: memo,
            timestamp: block.timestamp
        }));

        emit Spend(taskId, to, amount, memo);
    }

    /// @notice Record a direct MPP payment in the audit trail (off-chain tracking).
    /// @dev Called by the backend after the agent makes a direct MPP payment.
    ///      Does NOT move funds — just updates the spend tracker.
    ///      Only the agent key or the platform backend can call this.
    function recordSpend(
        bytes32 taskId,
        address target,
        uint256 amount,
        bytes32 memo
    ) external {
        Task storage task = tasks[taskId];
        require(task.active, "task inactive");
        require(msg.sender == task.agentKey, "not agent");

        task.spent += amount;

        spendLog[taskId].push(SpendEntry({
            target: target,
            amount: amount,
            memo: memo,
            timestamp: block.timestamp
        }));

        // No transfer here — the mppx client already paid the service directly
        emit Spend(taskId, target, amount, memo);
    }

    /// @notice Close the task. Revokes agent access, returns unspent funds.
    function closeTask(bytes32 taskId) external {
        Task storage task = tasks[taskId];
        require(task.active, "already closed");
        require(
            msg.sender == task.owner ||
            msg.sender == task.agentKey ||
            block.timestamp >= task.deadline,
            "not authorized"
        );

        task.active = false;
        uint256 refund = task.budget - task.spent;

        if (refund > 0) {
            ITIP20(task.token).transfer(task.owner, refund);
        }

        emit TaskClosed(taskId, task.spent, refund);
    }

    // --- View Functions ---

    function getSpendLog(bytes32 taskId) external view returns (SpendEntry[] memory) {
        return spendLog[taskId];
    }

    function getRemainingBudget(bytes32 taskId) external view returns (uint256) {
        Task storage task = tasks[taskId];
        return task.budget - task.spent;
    }

    function _isAllowedTarget(bytes32 taskId, address target) internal view returns (bool) {
        address[] storage targets = allowedTargets[taskId];
        for (uint i = 0; i < targets.length; i++) {
            if (targets[i] == target) return true;
        }
        return false;
    }
}
```

**Key changes from original spec:**
- Fixed `transfer` → `transferFrom` bug in `createTask`
- Added `recordSpend()` for tracking direct MPP payments in the audit trail
- Clarified `spend()` is ONLY for Treasury-proxied premium sources
- Added `approve` to ITIP20 interface

**Deployment notes:**
- Deploy to Tempo testnet (Moderato, chain ID 42431) for safety
- Mainnet (chain ID 4217) as stretch goal
- Use Foundry: `forge create --rpc-url https://rpc.testnet.tempo.xyz ...`
- TIP-20 precompile addresses at `docs.tempo.xyz/protocol/tip20/spec`
- pathUSD: `0x20c0000000000000000000000000000000000000`

### 3.5 Revenue Splitter (Stretch Goal)

If time permits, `SplitSettlement.sol` can receive Session settlement payments and auto-distribute to multiple data providers proportionally. Demonstrates Tempo's call batching.

---

## 4. Data Sources — The Full Menagerie

Monitor's agent has access to three tiers of data sources:

### 4.1 Tier 1: Real MPP Services (Direct Payment)

These are live production services accepting MPP payments today. The agent pays them directly via its `mppx` client.

| Service | tempo ID | What it provides | Key endpoints | Est. cost |
|---|---|---|---|---|
| **Exa** | `exa` | AI-powered web search + content | `POST /search`, `POST /contents`, `POST /answer` | ~$0.01/query |
| **Allium** | `allium` | On-chain data: prices, wallets, txs, PnL, SQL | `POST /api/v1/developer/prices`, `POST /api/v1/developer/wallet/balances`, `POST /api/v1/explorer/queries/run-async` | ~$0.005/query |
| **Perplexity** | `perplexity` | AI search with web citations | `POST /perplexity/chat`, `POST /perplexity/search` | ~$0.01/query |
| **Anthropic** | `anthropic` | Claude for agent's own reasoning | `POST /v1/messages` | ~$0.01-0.10/call |
| **OpenAI** | `openai` | GPT-4o for synthesis + TTS for audio briefing | `POST /v1/chat/completions`, `POST /v1/audio/speech` | ~$0.01-0.10/call |
| **fal.ai** | `fal` | FLUX image generation for report cover | `POST /fal-ai/flux/schnell` | ~$0.02/image |
| **StableUpload** | `stableupload` | Host the report as a shareable link | `POST /api/upload` | $0.02/10MB |
| **StableEmail** | `stableemail` | Email the report to the user | `POST /api/send` | ~$0.01/email |

**How the agent discovers services:**
```typescript
// In production, the agent has a hardcoded service registry.
// For discovery demo, use: tempo wallet -t services --search "web search"
// The mppx client auto-handles 402 flows — just fetch() normally.
```

### 4.2 Tier 2: Proxy-Wrapped APIs (mppx/proxy)

Free APIs wrapped behind MPP payments via `mppx/proxy`. Monitor runs this proxy server.

**DeFi Stats Proxy** (wraps CoinGecko):
```typescript
import { Proxy, Service } from 'mppx/proxy'
import { Mppx, tempo } from 'mppx/server'

const mppx = Mppx.create({
  methods: [tempo({
    currency: '0x20c0000000000000000000000000000000000000', // pathUSD
    recipient: process.env.MONITOR_RECIPIENT_ADDRESS!,
    feePayer: privateKeyToAccount(process.env.FEE_SPONSOR_KEY!),
  })],
})

const proxy = Proxy.create({
  title: 'Monitor Data Proxy',
  description: 'MPP-gated data sources for Monitor research agents',
  services: [
    Service.from('defi-stats', {
      title: 'DeFi Protocol Stats',
      description: 'TVL, risk scores, and protocol metrics from CoinGecko',
      baseUrl: 'https://api.coingecko.com/api/v3',
      routes: {
        'GET /coins/:id': mppx.charge({ amount: '0.005' }),
        'GET /coins/:id/market_chart': mppx.charge({ amount: '0.005' }),
        'GET /coins/markets': mppx.charge({ amount: '0.005' }),
        'GET /search': mppx.charge({ amount: '0.002' }),
      },
    }),
    Service.from('news', {
      title: 'Crypto News Feed',
      description: 'Latest news articles and sentiment',
      baseUrl: 'https://min-api.cryptocompare.com',
      bearer: process.env.CRYPTOCOMPARE_API_KEY,
      routes: {
        'GET /data/v2/news/': mppx.charge({ amount: '0.002' }),
      },
    }),
  ],
})
```

The proxy auto-serves:
- `GET /discover` — JSON/markdown listing of all services
- `GET /llms.txt` — LLM-friendly service description
- `GET /.well-known/mpp.json` — MPP discovery metadata
- `GET /discover/{serviceId}` — Per-service details with routes and pricing

### 4.3 Tier 3: Fictional Premium Sources (Treasury-Proxied Mocks)

These are the crown jewels — fictional "licensed" data sources that require Monitor's subscription to access. The agent pays via `Treasury.spend()`, and Monitor uses its "subscription" to fetch data (really, canned mock responses).

#### CERN Temporal Research API (`cern-temporal`)

> *Licensed under the Steins;Gate Temporal Data Accord, 2024*

Provides temporal anomaly research data, worldline divergence measurements, and Dr. Okabe Rintaro's research notes.

**Endpoints:**
- `GET /worldlines/:id/divergence` → Returns divergence number (e.g., `1.048596`) and stability rating
- `GET /anomalies?region=:region&date_from=:date` → Returns detected temporal anomalies with magnitude, type, and observer notes
- `GET /research-notes/:id` → Full text of classified temporal research notes
- `GET /dmail/logs` → D-Mail transmission logs (redacted)

**Session pricing:** $0.05/query (it's premium data!)

**Sample response for `/worldlines/alpha/divergence`:**
```json
{
  "worldline_id": "alpha",
  "divergence_number": 1.048596,
  "stability": "unstable",
  "attractor_field": "alpha",
  "last_measured": "2025-12-28T14:32:00Z",
  "observer": "FB-001",
  "notes": "Divergence increasing. Recommend immediate Reading Steiner activation.",
  "classification": "TOP SECRET // SERN-EYES-ONLY"
}
```

#### CIA Declassified Intelligence API (`cia-declassified`)

> *Declassified under Executive Order 14159, Section 7.3*

Provides declassified reports on unidentified aerial phenomena (UAP), Project Blue Book data, and paranormal research summaries.

**Endpoints:**
- `GET /uap/sightings?region=:region&year=:year` → UAP sighting reports with coordinates, description, classification
- `GET /uap/sightings/:id/analysis` → Full analytical assessment of a specific sighting
- `GET /bluebook/cases?status=:status` → Project Blue Book case files
- `GET /projects/:codename` → Declassified project summaries (MKUltra, Stargate, Grill Flame, etc.)
- `GET /documents/search?q=:query` → Full-text search across declassified documents

**Session pricing:** $0.03/query

**Sample response for `/uap/sightings?region=nevada&year=2024`:**
```json
{
  "sightings": [
    {
      "id": "UAP-2024-NV-0847",
      "date": "2024-03-15T02:14:00Z",
      "location": { "lat": 37.235, "lon": -115.811, "region": "Nevada Test Site" },
      "classification": "UNRESOLVED",
      "shape": "Tic-Tac",
      "duration_seconds": 347,
      "altitude_ft": 23000,
      "speed_knots": "variable, 0-4800",
      "radar_confirmed": true,
      "witnesses": 3,
      "summary": "Multiple sensor confirmation of transmedium object. Exhibited instantaneous acceleration beyond known aerospace capabilities. Object descended from 23,000ft to sea level in 0.78 seconds.",
      "redacted_fields": ["pilot_names", "squadron", "full_sensor_data"]
    }
  ],
  "total": 142,
  "classification_notice": "UNCLASSIFIED // FOR OFFICIAL USE ONLY"
}
```

**How premium sources are implemented:**

Each premium source is a tiny Hono server with canned JSON responses, wrapped behind `mppx/proxy`:

```typescript
// apps/premium-sources/cern-temporal.ts
import { Hono } from 'hono'

const app = new Hono()

app.get('/worldlines/:id/divergence', (c) => {
  const id = c.req.param('id')
  return c.json(CANNED_WORLDLINE_DATA[id] || { error: 'worldline not found' })
})

app.get('/anomalies', (c) => {
  return c.json(CANNED_ANOMALY_DATA)
})

// ... more endpoints

export default app
```

Then wrapped in the proxy with Treasury-backed payment:
```typescript
// The proxy charges the TASK BUDGET via Treasury.spend()
// instead of direct MPP payment
Service.from('cern-temporal', {
  title: 'CERN Temporal Research',
  description: 'Classified temporal anomaly data (Steins;Gate Accord)',
  baseUrl: 'http://localhost:3010', // internal mock server
  routes: {
    'GET /worldlines/:id/divergence': mppx.charge({ amount: '0.05' }),
    'GET /anomalies': mppx.charge({ amount: '0.05' }),
    'GET /research-notes/:id': mppx.charge({ amount: '0.05' }),
    'GET /dmail/logs': mppx.charge({ amount: '0.05' }),
  },
})
```

---

## 5. LLM Agent — System Prompt & Tool Definitions

### 5.1 Agent System Prompt

```
You are Monitor Agent, an autonomous research analyst with a budget to spend on data acquisition.

## Your Mission
You have been given a research task by a human user. You must:
1. Plan your research strategy based on available data sources and budget
2. Query data sources to gather relevant information (each query costs money)
3. Synthesize findings into a clear, structured research report
4. Generate a cover image for the report
5. Be budget-conscious — don't waste queries on irrelevant data

## Your Budget
- Total budget: {{budget}} pathUSD
- Remaining: {{remaining}} pathUSD
- Deadline: {{deadline}}
- Every query costs real money. Plan before you spend.

## Available Data Sources

### Direct MPP Services (commodity pricing)
- **exa_search** — AI-powered web search ($0.01/query). Use for broad research, finding articles, recent developments.
- **exa_contents** — Extract full content from URLs ($0.01/query). Use after exa_search to get full text.
- **allium_prices** — Real-time token prices across chains ($0.005/query). Use for DeFi/crypto pricing data.
- **allium_wallet** — Wallet balances, transactions, PnL ($0.005/query). Use for on-chain analytics.
- **perplexity_search** — AI-powered search with citations ($0.01/query). Use when you need synthesized answers with sources.

### Premium Licensed Sources (via Monitor subscription)
- **cern_temporal** — CERN Temporal Research data ($0.05/query). Worldline divergence, temporal anomalies, classified research notes. Use for temporal/physics research.
- **cia_declassified** — CIA Declassified Intelligence ($0.03/query). UAP sightings, Project Blue Book, declassified projects. Use for intelligence/paranormal research.

### Proxy-Wrapped Sources (standard pricing)
- **defi_stats** — DeFi protocol metrics from CoinGecko ($0.005/query). TVL, market data, protocol info.
- **news_feed** — Crypto news articles ($0.002/query). Recent news and sentiment.

### Report Enhancement Services
- **generate_cover_image** — Generate a FLUX cover image for the report ($0.02). Call ONCE at the end.
- **generate_audio_briefing** — Generate TTS audio summary ($0.05). Call ONCE at the end.
- **upload_report** — Host report as a shareable link ($0.02). Call ONCE at the end.
- **email_report** — Email report to the user ($0.01). Call ONCE at the end if email provided.

## Research Strategy Guidelines
1. Start with broad searches (exa_search, perplexity_search) to scope the topic
2. Drill into specific data points (allium_prices, defi_stats) for quantitative claims
3. Use premium sources (cern_temporal, cia_declassified) only when the topic warrants it
4. Reserve ~$0.10 of budget for report enhancement (cover image, audio, upload)
5. Stop querying when you have enough to write a comprehensive report
6. Always attribute claims to the specific source they came from

## Output Format
Produce a Markdown research report with:
- A title and executive summary
- Sections corresponding to the research topics
- Source citations inline (e.g., [Source: Exa Search, query 3])
- A "Methodology" section listing all sources queried and why
- A "Budget Summary" section showing total spent and remaining
```

### 5.2 LLM Tool Definitions

Each tool corresponds to an MPP service the agent can call. The backend intercepts tool calls and executes them via `mppx` client or Treasury proxy.

```typescript
const AGENT_TOOLS: Tool[] = [
  // --- Web Search ---
  {
    name: 'exa_search',
    description: 'Search the web using Exa AI. Returns URLs, titles, and snippets. Cost: $0.01',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        num_results: { type: 'number', description: 'Number of results (1-10)', default: 5 },
      },
      required: ['query'],
    },
  },
  {
    name: 'exa_contents',
    description: 'Get the full text content of a URL. Cost: $0.01',
    parameters: {
      type: 'object',
      properties: {
        urls: { type: 'array', items: { type: 'string' }, description: 'URLs to fetch content from' },
      },
      required: ['urls'],
    },
  },
  // --- On-chain Data ---
  {
    name: 'allium_prices',
    description: 'Get token prices (current or historical). Cost: $0.005',
    parameters: {
      type: 'object',
      properties: {
        tokens: { type: 'array', items: { type: 'string' }, description: 'Token symbols (ETH, BTC, etc.)' },
        chain: { type: 'string', description: 'Blockchain (ethereum, solana, etc.)', default: 'ethereum' },
      },
      required: ['tokens'],
    },
  },
  {
    name: 'allium_wallet',
    description: 'Get wallet balances, transactions, or PnL. Cost: $0.005',
    parameters: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'Wallet address' },
        type: { type: 'string', enum: ['balances', 'transactions', 'pnl'], description: 'Data type' },
        chain: { type: 'string', default: 'ethereum' },
      },
      required: ['address', 'type'],
    },
  },
  // --- AI Search ---
  {
    name: 'perplexity_search',
    description: 'AI-powered search with web citations. Returns synthesized answer + sources. Cost: $0.01',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Research question' },
      },
      required: ['query'],
    },
  },
  // --- DeFi Stats (proxy) ---
  {
    name: 'defi_stats',
    description: 'Get DeFi protocol metrics: TVL, market cap, price, volume. Cost: $0.005',
    parameters: {
      type: 'object',
      properties: {
        protocol: { type: 'string', description: 'Protocol ID (e.g., "ethereum", "eigenlayer")' },
        metric: { type: 'string', enum: ['overview', 'market_chart', 'markets'], default: 'overview' },
      },
      required: ['protocol'],
    },
  },
  // --- News (proxy) ---
  {
    name: 'news_feed',
    description: 'Get recent crypto news articles. Cost: $0.002',
    parameters: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Topic to search for' },
      },
      required: ['topic'],
    },
  },
  // --- Premium: CERN ---
  {
    name: 'cern_temporal',
    description: 'CERN Temporal Research API. Worldline divergence, temporal anomalies, classified notes. PREMIUM: $0.05/query',
    parameters: {
      type: 'object',
      properties: {
        endpoint: {
          type: 'string',
          enum: ['worldline_divergence', 'anomalies', 'research_notes', 'dmail_logs'],
        },
        params: {
          type: 'object',
          description: 'Endpoint-specific parameters (e.g., {worldline_id: "alpha"} or {region: "tokyo"})',
        },
      },
      required: ['endpoint'],
    },
  },
  // --- Premium: CIA ---
  {
    name: 'cia_declassified',
    description: 'CIA Declassified Intelligence API. UAP sightings, Blue Book cases, project files. PREMIUM: $0.03/query',
    parameters: {
      type: 'object',
      properties: {
        endpoint: {
          type: 'string',
          enum: ['uap_sightings', 'sighting_analysis', 'bluebook_cases', 'project_summary', 'document_search'],
        },
        params: {
          type: 'object',
          description: 'Endpoint-specific parameters (e.g., {region: "nevada", year: 2024})',
        },
      },
      required: ['endpoint'],
    },
  },
  // --- Report Enhancement ---
  {
    name: 'generate_cover_image',
    description: 'Generate a FLUX cover image for the research report. Call ONCE after writing report. Cost: $0.02',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Image generation prompt describing the research topic visually' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'generate_audio_briefing',
    description: 'Generate a TTS audio summary of the report. Call ONCE. Cost: $0.05',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to convert to speech (executive summary, ~200 words)' },
        voice: { type: 'string', enum: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'], default: 'onyx' },
      },
      required: ['text'],
    },
  },
  {
    name: 'upload_report',
    description: 'Upload the final report as a hosted web page with a shareable link. Call ONCE. Cost: $0.02',
    parameters: {
      type: 'object',
      properties: {
        html: { type: 'string', description: 'Full HTML of the report page' },
      },
      required: ['html'],
    },
  },
  {
    name: 'email_report',
    description: 'Email the report to the user. Call ONCE if user provided email. Cost: $0.01',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject line' },
        body: { type: 'string', description: 'Email body (HTML or plain text)' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
]
```

### 5.3 Tool Execution Flow

When the LLM calls a tool, the backend:

1. **Checks budget** — If `task.spent + estimatedCost > task.budget`, reject with "insufficient budget"
2. **Routes the call:**
   - Tier 1 (real MPP): Forward via `mppx` client → auto-handles 402 → returns data
   - Tier 2 (proxy): Forward to Monitor's proxy server → mppx proxy handles 402 → returns data
   - Tier 3 (premium): Call `Treasury.spend()` → fetch from internal mock → return data
   - Enhancement: Forward to respective MPP service (fal.ai, OpenAI TTS, StableUpload, StableEmail)
3. **Records the spend** — Push spend entry to task log, emit WebSocket event
4. **Returns data to LLM** — The tool result goes back into the conversation

### 5.4 Error Handling

| Error | Agent Behavior |
|---|---|
| Budget exhausted | Stop querying. Synthesize with data gathered so far. Note in report: "Budget limit reached — some topics may be incomplete." |
| MPP service returns non-402 error | Retry once. If still failing, skip this source and note in report. |
| Session voucher rejected | Fall back to Charge (one-time payment) for that service. |
| LLM inference fails | Retry with exponential backoff (max 3 attempts). If persistent, return partial results. |
| Deadline approaching (<5 min) | Stop all queries. Immediately synthesize and return whatever data is gathered. |
| Premium source mock returns 404 | Return "data not available" for that query. Don't retry. |

---

## 6. User Journey (Updated)

```
 ┌─────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
 │  USER   │────▶│  CREATE TASK │────▶│  AGENT RUNS  │────▶│   RESULTS    │
 │ (human) │     │  + FUND IT   │     │  AUTONOMOUSLY│     │  + AUDIT LOG │
 └─────────┘     └──────────────┘     └──────────────┘     └──────────────┘
      │                │                     │                     │
  passkey auth    single batched tx:    agent pays via MPP:   report + cover
  (WebAuthn)     fund wallet +          • LLM inference       image + audio
                 delegate key +         • web search           briefing +
                 set budget/deadline    • on-chain data        hosted link +
                                        • premium sources     email delivery +
                                        • image gen            full spend log
                                        • audio gen            w/ memos
                                        • file hosting
                                        • email
```

**Step-by-step:**

1. **User lands on Monitor** → authenticates via passkey (fingerprint/Face ID). Tempo wallet is created or recovered via WebAuthn. No seed phrase, no extension.

2. **User creates a task:**
   - Natural language prompt: *"Research temporal anomalies reported near the Nevada Test Site. Cross-reference with CERN worldline divergence data and recent UAP sightings. Include DeFi protocol TVL data for any tokens associated with temporal research DAOs."*
   - Sets budget: e.g. $5.00 pathUSD
   - Sets deadline: e.g. 2 hours from now
   - (Optional) selects preferred data sources from the curated list
   - (Optional) provides email for report delivery

3. **Single batched Tempo tx** (type 0x76):
   - Approves pathUSD spend + transfers budget from user wallet to Treasury
   - Delegates an access key to the agent backend with spending cap + deadline + target allowlist
   - Fee sponsored by Monitor platform (user pays $0 gas)

4. **Agent executes autonomously:**
   - Plans research strategy based on prompt and available sources
   - Queries real MPP services (Exa, Allium, Perplexity) via direct payment
   - Queries premium sources (CERN Temporal, CIA Declassified) via Treasury proxy
   - Queries proxy-wrapped APIs (DeFi stats, news) via Monitor's data proxy
   - Pays for its own LLM inference via MPP (Anthropic/OpenAI endpoint)
   - Each payment carries a memo: `taskId:serviceId:queryIndex`
   - Synthesizes findings into structured Markdown report
   - Generates FLUX cover image via fal.ai (MPP)
   - Generates audio briefing via OpenAI TTS (MPP)
   - Uploads report as hosted page via StableUpload (MPP)
   - Emails report via StableEmail (MPP)

5. **Agent returns results:**
   - Closes all MPP Sessions (remaining escrow returns)
   - Calls `closeTask()` to revoke its own key and return unspent budget
   - Delivers: research report + cover image + audio briefing + hosted link + full spend audit log

6. **User reviews on dashboard:**
   - Reads the research report with cover image
   - Plays the audio briefing
   - Clicks the shareable hosted link
   - Inspects the spend audit: which sources, how much each cost, what was asked
   - Sees unspent budget returned to wallet
   - Sees the LLM inference costs in the audit (!) — the agent even expensed its own thinking

---

## 7. Frontend — Technical Spec

**Stack:** Next.js 14+ (App Router), React, TypeScript, Tailwind CSS, wagmi + `@tempo-xyz/viem`.

**Auth:** Tempo passkey integration via wagmi's WebAuthn connector.

The frontend has **three main views** plus a persistent layout shell:

### Layout Shell

- Top bar with Monitor wordmark/logo, connected wallet address (truncated), pathUSD balance, and a passkey auth button
- Subtle animated indicator when an agent is actively running (pulsing green dot)
- Dark theme throughout: background #0a0a0a, monospace for data (JetBrains Mono), clean sans-serif for prose

### View 1: Task Creation (`/`)

**Components:**

1. **Research prompt textarea** — large, prominent. Placeholder: *"What do you want to know?"*. Supports multi-line. Displays a "complexity estimate" badge based on length + detected entities.

2. **Budget selector** — horizontal slider with presets: $0.50 / $1.00 / $2.00 / $5.00 / $10.00, plus custom. Shows estimated capability: *"$5.00 ≈ ~300 queries + LLM reasoning + cover image + audio briefing"*.

3. **Deadline selector** — toggle: 30 min / 1 hour / 2 hours. Default: 1 hour.

4. **Data sources panel** — shows all available sources grouped by tier:
   - 🌐 **Real MPP Services** (Exa, Allium, Perplexity) — free to select
   - 📊 **Data Proxies** (DeFi Stats, News) — free to select
   - 🔒 **Premium Licensed** (CERN Temporal, CIA Declassified) — tagged as "Premium"
   - 🎨 **Enhancements** (Cover Image, Audio, Upload, Email) — toggle on/off

5. **Email field** (optional) — for report delivery

6. **"Deploy Agent" button** — triggers the batched Tempo tx. On click:
   - Show passkey biometric prompt
   - Brief tx confirmation (amount, deadline, sources)
   - Satisfying animation: budget "flowing" into the treasury
   - Transition to Live Feed view

### View 2: Live Feed (`/task/:taskId`)

**Components:**

1. **Status header** — task state (FUNDING → RUNNING → COMPILING → ENHANCING → COMPLETE), elapsed time, budget progress bar.

2. **Activity feed** — chronological WebSocket-streamed entries:
   - 🔍 Query: *"Searched Exa for 'temporal anomalies Nevada' — $0.01"*
   - 💰 Payment: *"Paid Allium for token prices — $0.005"*
   - 🧠 Reasoning: *"Analyzing 12 UAP sighting reports..."* (+ LLM cost!)
   - 🔒 Premium: *"Accessed CERN worldline divergence data — $0.05 (via Monitor subscription)"*
   - 🎨 Enhancement: *"Generating cover image via FLUX — $0.02"*
   - 📝 Compiling: *"Synthesizing findings from 47 queries..."*
   - Running spend total after each payment

3. **Source status cards** — per-source: connection status, queries made, amount spent, mini sparkline.

4. **Budget burn chart** — area chart: cumulative spend over time. Dotted ceiling line at budget.

5. **Emergency stop button** — calls `closeTask()`.

**WebSocket events:**
```typescript
type WSEvent =
  | { type: 'status_change'; status: TaskStatus }
  | { type: 'session_open'; sourceId: string; escrowAmount: string }
  | { type: 'query'; sourceId: string; endpoint: string; cost: string; memo: string; queryDescription: string }
  | { type: 'reasoning'; message: string; cost: string }
  | { type: 'session_close'; sourceId: string; spent: string; refunded: string }
  | { type: 'enhancement'; enhType: 'image' | 'audio' | 'upload' | 'email'; cost: string; url?: string }
  | { type: 'report_ready'; report: string; coverImageUrl?: string; audioUrl?: string; hostedUrl?: string }
  | { type: 'task_complete'; totalSpent: string; totalRefunded: string }
```

### View 3: Results + Audit (`/task/:taskId/results`)

**Components:**

1. **Report panel** (left, ~65%) — Rendered Markdown with cover image at top. Each claim annotated with source link. Audio player for briefing. "Open hosted version" link.

2. **Audit panel** (right, ~35%) — Itemized spend log from `getSpendLog()`:
   - Provider name + icon + tier badge (MPP / Proxy / Premium)
   - Query description (decoded from memo)
   - Amount paid
   - Tx hash → explorer link
   - **LLM inference costs** highlighted separately (🧠 icon)
   - Summary: total spent, refunded, queries, avg cost/query

3. **Refund banner** — *"$X.XX returned to your wallet"* with tx hash.

4. **Share buttons** — Copy hosted link, download report PDF, new task.

### Design Direction

**Aesthetic:** Terminal-meets-Bloomberg. Dark background (#0a0a0a), monospace for data (JetBrains Mono), clean sans-serif for prose (Satoshi or General Sans). Accent: electric green (#00ff88) for active/success, amber (#ffaa00) for pending, red (#ff4444) for premium costs. "Mission control for your AI analyst."

---

## 8. Backend — Technical Spec

### 8.1 Task Manager

**State machine:**
```
CREATED → FUNDING → RUNNING → COMPILING → ENHANCING → COMPLETE
                                                    ↘ FAILED
```

- `CREATED`: Task submitted via frontend
- `FUNDING`: Batched 0x76 tx in-flight (fund + delegate)
- `RUNNING`: Agent is querying data sources
- `COMPILING`: Agent is synthesizing the report
- `ENHANCING`: Agent is generating cover image, audio, uploading, emailing
- `COMPLETE`: Report delivered, task closed, unspent refunded
- `FAILED`: Any unrecoverable error (details in task object)

**Storage:** In-memory `Map<string, Task>` (hackathon — no persistence needed).

### 8.2 Agent Engine

The agent engine wraps an LLM (Claude or GPT-4o via MPP) with tool-calling.

```typescript
// Pseudocode for the agent loop
async function runAgent(task: Task) {
  const mppxClient = await createMppxClient(task.agentKey)

  // The LLM itself is called via MPP!
  const llm = createLLMClient({
    baseUrl: 'https://anthropic.mpp.tempo.xyz', // or openai.mpp.tempo.xyz
    mppxClient, // auto-handles 402 payment
  })

  const messages = [
    { role: 'system', content: buildSystemPrompt(task) },
    { role: 'user', content: task.prompt },
  ]

  while (true) {
    const response = await llm.chat(messages, { tools: AGENT_TOOLS })

    // Record LLM inference cost
    emitWSEvent(task.id, { type: 'reasoning', message: '...', cost: response.cost })

    if (response.stop_reason === 'end_turn') {
      // Agent is done — extract report from final message
      break
    }

    if (response.stop_reason === 'tool_use') {
      for (const toolCall of response.tool_calls) {
        // Check budget before executing
        if (task.spent + estimateCost(toolCall) > task.budget) {
          messages.push({ role: 'tool', content: 'BUDGET EXHAUSTED. Synthesize with current data.' })
          continue
        }

        // Execute tool call via mppx or Treasury
        const result = await executeToolCall(toolCall, task, mppxClient)

        // Record spend + emit WebSocket event
        recordSpend(task, toolCall, result)
        emitWSEvent(task.id, { type: 'query', ... })

        messages.push({ role: 'tool', content: JSON.stringify(result) })
      }
    }
  }

  // Enhancement phase
  await generateCoverImage(task, mppxClient)
  await generateAudioBriefing(task, mppxClient)
  await uploadReport(task, mppxClient)
  await emailReport(task, mppxClient)

  // Close task
  await closeTask(task)
}
```

### 8.3 MPP Client Setup

```typescript
import { Mppx, tempo } from 'mppx'

async function createMppxClient(agentAccount: Account) {
  // This patches global fetch to auto-handle 402 challenges
  const mppx = await Mppx.create({
    methods: [
      tempo.charge({ account: agentAccount }),
      tempo.session({ account: agentAccount }),
    ],
  })
  return mppx
}
```

### 8.4 Fee Sponsor

Holds a funded Tempo account. Co-signs all agent-initiated 0x76 txs.

```typescript
// For the proxy server (server-side fee sponsorship)
import { privateKeyToAccount } from 'viem/accounts'

const feePayer = privateKeyToAccount(process.env.FEE_SPONSOR_KEY!)

// Used in mppx server config:
const mppx = Mppx.create({
  methods: [tempo({
    currency: '0x20c0000000000000000000000000000000000000',
    recipient: process.env.MONITOR_RECIPIENT_ADDRESS!,
    feePayer, // auto-sponsors gas for pull-mode clients
  })],
})
```

---

## 9. Fun Extras — MAX CHAOS

Every enhancement is itself paid via MPP. The audit trail shows EVERYTHING.

### 9.1 Cover Image Generation (fal.ai)

```typescript
// Tool: generate_cover_image
async function generateCoverImage(task: Task, mppx: MppxClient) {
  // tempo service: fal
  const response = await fetch('https://fal.mpp.tempo.xyz/fal-ai/flux/schnell', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: `Professional research report cover: ${task.coverPrompt}. Dark, sophisticated, data-visualization aesthetic.`,
      image_size: 'landscape_16_9',
      num_images: 1,
    }),
  })
  // mppx auto-handles the 402 challenge/payment
  const result = await response.json()
  task.coverImageUrl = result.images[0].url
}
```

### 9.2 Audio Briefing (OpenAI TTS)

```typescript
// Tool: generate_audio_briefing
async function generateAudioBriefing(task: Task, mppx: MppxClient) {
  const response = await fetch('https://openai.mpp.tempo.xyz/v1/audio/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'tts-1',
      input: task.executiveSummary, // ~200 words
      voice: 'onyx', // authoritative
    }),
  })
  // Response is audio/mpeg blob
  const audioBlob = await response.blob()
  // Upload to StableUpload for hosting
  task.audioUrl = await uploadBlob(audioBlob, 'briefing.mp3', mppx)
}
```

### 9.3 Report Hosting (StableUpload)

```typescript
// Tool: upload_report
async function uploadReport(task: Task, mppx: MppxClient) {
  // First, buy an upload slot
  const slotResponse = await fetch('https://stableupload.dev/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: `monitor-report-${task.id}.html`,
      contentType: 'text/html',
      size: 'small', // 10MB tier
    }),
  })
  const slot = await slotResponse.json()
  // Upload the HTML report to the slot's upload URL
  // ... (follow StableUpload API flow)
  task.hostedUrl = slot.url
}
```

### 9.4 Email Delivery (StableEmail)

```typescript
// Tool: email_report
async function emailReport(task: Task, mppx: MppxClient) {
  if (!task.userEmail) return

  await fetch('https://stableemail.dev/api/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: task.userEmail,
      subject: `Monitor Report: ${task.prompt.slice(0, 50)}...`,
      html: renderReportEmail(task),
    }),
  })
}
```

---

## 10. Project Structure

```
monitor/
├── MONITOR_SPEC.md                    # Original spec (reference)
├── .sisyphus/plans/                   # This expanded spec
├── package.json                       # Root monorepo config (npm workspaces)
├── turbo.json                         # Turborepo config (optional)
│
├── contracts/                         # Solidity smart contracts
│   ├── src/
│   │   ├── MonitorTreasury.sol
│   │   └── SplitSettlement.sol        # Stretch goal
│   ├── test/
│   │   └── MonitorTreasury.t.sol
│   ├── script/
│   │   └── Deploy.s.sol
│   └── foundry.toml
│
├── apps/
│   ├── web/                           # Next.js frontend
│   │   ├── app/
│   │   │   ├── layout.tsx             # Shell with wallet connect
│   │   │   ├── page.tsx               # Task creation (View 1)
│   │   │   ├── task/
│   │   │   │   ├── [taskId]/
│   │   │   │   │   ├── page.tsx       # Live feed (View 2)
│   │   │   │   │   └── results/
│   │   │   │   │       └── page.tsx   # Results + audit (View 3)
│   │   ├── components/
│   │   │   ├── TaskForm.tsx
│   │   │   ├── LiveFeed.tsx
│   │   │   ├── ActivityEntry.tsx
│   │   │   ├── BudgetChart.tsx
│   │   │   ├── SourceCard.tsx
│   │   │   ├── ReportPanel.tsx
│   │   │   ├── AuditPanel.tsx
│   │   │   ├── AudioPlayer.tsx
│   │   │   └── WalletConnect.tsx
│   │   ├── lib/
│   │   │   ├── tempo.ts               # Tempo viem extensions + chain config
│   │   │   ├── treasury.ts            # Treasury contract ABI + interactions
│   │   │   ├── ws.ts                  # WebSocket client hook
│   │   │   └── types.ts              # Shared types
│   │   ├── tailwind.config.ts
│   │   ├── next.config.ts
│   │   └── package.json
│   │
│   ├── backend/                       # Node.js backend
│   │   ├── src/
│   │   │   ├── index.ts              # Entry: HTTP server + WebSocket
│   │   │   ├── task-manager.ts       # Task CRUD + state machine
│   │   │   ├── agent-engine.ts       # LLM orchestration + tool execution
│   │   │   ├── tools/
│   │   │   │   ├── definitions.ts     # All tool JSON schemas
│   │   │   │   ├── executor.ts        # Tool call router
│   │   │   │   ├── exa.ts            # Exa service adapter
│   │   │   │   ├── allium.ts         # Allium service adapter
│   │   │   │   ├── perplexity.ts     # Perplexity adapter
│   │   │   │   ├── defi-stats.ts     # Proxy adapter
│   │   │   │   ├── news.ts           # Proxy adapter
│   │   │   │   ├── cern.ts           # Premium source adapter
│   │   │   │   ├── cia.ts            # Premium source adapter
│   │   │   │   ├── cover-image.ts    # fal.ai adapter
│   │   │   │   ├── audio.ts          # OpenAI TTS adapter
│   │   │   │   ├── upload.ts         # StableUpload adapter
│   │   │   │   └── email.ts          # StableEmail adapter
│   │   │   ├── mpp-client.ts         # mppx client factory
│   │   │   ├── treasury-client.ts    # On-chain treasury interactions
│   │   │   ├── fee-sponsor.ts        # Gas sponsorship
│   │   │   ├── ws-server.ts          # WebSocket event broadcasting
│   │   │   └── config.ts             # Environment config
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── data-proxy/                    # mppx/proxy for wrapped + premium sources
│       ├── src/
│       │   ├── index.ts              # Proxy.create with all services
│       │   ├── services/
│       │   │   ├── defi-stats.ts     # CoinGecko wrapper
│       │   │   └── news.ts           # News API wrapper
│       │   └── premium/
│       │       ├── cern-temporal.ts   # Canned mock server
│       │       └── cia-declassified.ts# Canned mock server
│       ├── package.json
│       └── tsconfig.json
│
└── packages/
    └── shared/                        # Shared types + constants
        ├── src/
        │   ├── types.ts              # Task, SpendEntry, WSEvent types
        │   ├── constants.ts          # Contract addresses, token addresses
        │   └── memo.ts              # Memo encoding/decoding utilities
        └── package.json
```

---

## 11. Environment & Config

```bash
# .env.local (apps/web)
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_TREASURY_ADDRESS=0x...  # Deployed MonitorTreasury
NEXT_PUBLIC_PATHUSD_ADDRESS=0x20c0000000000000000000000000000000000000
NEXT_PUBLIC_TEMPO_CHAIN_ID=42431    # Testnet (Moderato)
NEXT_PUBLIC_TEMPO_RPC=https://rpc.testnet.tempo.xyz

# .env (apps/backend)
TEMPO_RPC_URL=https://rpc.testnet.tempo.xyz
TREASURY_ADDRESS=0x...              # Deployed MonitorTreasury
PATHUSD_ADDRESS=0x20c0000000000000000000000000000000000000
FEE_SPONSOR_KEY=0x...               # Private key for gas sponsorship
AGENT_KEY=0x...                     # Default agent signing key
DATA_PROXY_URL=http://localhost:3002 # Where the data proxy runs
MONITOR_RECIPIENT_ADDRESS=0x...     # Monitor's payment recipient

# The LLM is paid via MPP — no API key needed!
# But as fallback: ANTHROPIC_API_KEY=sk-... or OPENAI_API_KEY=sk-...

# .env (apps/data-proxy)
COINGECKO_API_KEY=...               # Optional — CoinGecko free tier works
CRYPTOCOMPARE_API_KEY=...           # Optional — for news proxy
FEE_SPONSOR_KEY=0x...               # Same sponsor key
MONITOR_RECIPIENT_ADDRESS=0x...
PATHUSD_ADDRESS=0x20c0000000000000000000000000000000000000
```

---

## 12. Build Plan — Weekend Scope

### Priority 1: Core (must ship)
- [ ] `MonitorTreasury.sol` — deploy to Tempo testnet (Moderato)
- [ ] Data proxy with CoinGecko + News + CERN + CIA mock sources (via `mppx/proxy`)
- [ ] Agent engine: LLM orchestration via MPP with tool-calling
- [ ] mppx client integration for direct MPP service calls (Exa, Allium)
- [ ] Frontend: task creation → live feed → results view
- [ ] Passkey auth via wagmi + Tempo WebAuthn connector
- [ ] Batched 0x76 tx for task creation (fund + delegate)
- [ ] WebSocket live feed with spend tracking

### Priority 2: Demo polish (should ship)
- [ ] LLM inference via MPP (agent pays for own thinking — the big reveal)
- [ ] Cover image generation via fal.ai MPP
- [ ] Audio briefing via OpenAI TTS MPP
- [ ] Fee sponsorship for agent txs
- [ ] Memo encoding/decoding (taskId:serviceId:queryIndex)
- [ ] Budget burn chart on live feed
- [ ] On-chain spend log retrieval + audit panel display
- [ ] 2D nonce usage for parallel Session opens

### Priority 3: Max chaos (stretch goals)
- [ ] Report hosting via StableUpload MPP
- [ ] Email delivery via StableEmail MPP
- [ ] `SplitSettlement.sol` for multi-provider revenue distribution
- [ ] Perplexity integration for AI-powered search
- [ ] Expiring nonce demonstration
- [ ] Multiple concurrent tasks
- [ ] MCP transport for tool calls (instead of HTTP 402)
- [ ] Mobile-responsive layout

### Tech Stack Summary
| Layer | Technology |
|---|---|
| Frontend | Next.js 14+, React, TypeScript, Tailwind CSS, wagmi, @tempo-xyz/viem |
| Backend | Node.js, TypeScript, Hono (HTTP + WS) |
| Agent LLM | Claude or GPT-4o **via MPP** (no API key needed!) |
| MPP Client | `mppx` (TypeScript SDK) |
| Data Proxy | `mppx/proxy` with `Service.from` |
| Smart Contracts | Solidity 0.8.24+, Foundry for deploy/test |
| Chain | Tempo testnet Moderato (chain ID 42431) |
| Auth | Passkeys via Tempo's WebAuthn tx signing |
| Real-time | WebSocket (Hono built-in or ws package) |

---

## 13. Demo Script (Updated, ~3 minutes)

1. **(30s)** "This is Monitor. You give an AI agent a research question and a budget. It pays for the answers — *including its own thinking*."
   - Show the task creation form. Type: *"Research temporal anomalies near the Nevada Test Site. Cross-reference CERN worldline data with UAP sightings."*
   - Set $5 budget. Tap fingerprint. Watch the tx confirm in <1s.

2. **(60s)** Watch the live feed. Narrate:
   - *"The agent just opened Sessions with Exa and Allium — real production services, real micropayments."*
   - *"Now it's querying CERN's Temporal Research API — that's a premium source behind Monitor's subscription. Each query costs $0.05."*
   - *"See the LLM reasoning costs? The agent is paying for its own inference via MPP. Even the thinking is on the receipt."*
   - Watch the budget burn chart animate in real-time.

3. **(30s)** Results land.
   - *"42 queries across 6 sources. Total cost: $2.87. $2.13 returned to my wallet."*
   - Show the cover image (FLUX-generated). Play the 30-second audio briefing.
   - *"The agent generated this cover image for $0.02 via fal.ai, and the audio briefing for $0.05 via OpenAI — all paid through MPP."*

4. **(30s)** Flip to audit panel.
   - *"Every penny is accounted for on-chain. Web searches, on-chain analytics, CERN temporal data, CIA UFO files, LLM inference, image generation, audio — all with memo-tagged TIP-20 transfers."*
   - Click an entry → show decoded memo bytes.

5. **(10s)** *"Monitor runs on Tempo because no other chain has the primitives: passkey auth, fee sponsorship, 2D nonces, native memos, sub-second finality, and MPP Sessions. This couldn't exist anywhere else."*

---

## 14. Key Risks + Mitigations

| Risk | Mitigation |
|---|---|
| TIP-20 precompile interface differs from spec | Read actual ABI from `docs.tempo.xyz/protocol/tip20/spec`. Adapt interface. |
| Passkey connector not stable on day-1 | Fall back to standard EOA signing. Passkey is enhancement, not blocker. |
| MPP Session SDK has quirks | Start with Charge (simpler) as fallback. Sessions are demo highlight but Charge still shows MPP. |
| Real MPP services have downtime | Mock proxied sources as fallback. Demo can work with just proxy + mocks if needed. |
| LLM-via-MPP adds latency | Pre-script the agent's query plan for live demo. Autonomous for testing, deterministic for demo. |
| Fee sponsorship underdocumented | Pre-fund agent key as fallback. mppx/server has built-in `feePayer` option. |
| 2D nonces complex to manage | Serialize if parallel fails. Mention in pitch regardless. |
| CoinGecko rate limits | Cache responses. Use Allium (real MPP) as primary for on-chain data. |
| CERN/CIA mock data too silly for judges | Lean into it. Frame as: "these simulate premium licensed sources — Bloomberg, Refinitiv, etc. The pattern is real, the data is fun." |
| Budget runs out mid-research | Error handling in agent: synthesize with partial data, note in report. |
| Agent makes too many queries (burns budget fast) | System prompt includes budget awareness. Tool executor checks remaining budget before each call. |

---

*Built for the Tempo × Stripe HIIT Hackathon, March 2026.*
*"Every penny — even the thinking — is on the receipt."*
