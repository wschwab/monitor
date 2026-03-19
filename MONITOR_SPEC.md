# MONITOR — Hackathon Project Spec

> "Monitoring the situation."
>
> Delegate a research task to an AI agent. Give it an allowance. It pays for the answers.

---

## 1. Project Summary

Monitor is a research-agent delegation platform built on Tempo and MPP. A user describes a research task, sets a stablecoin budget, and hands it off to an AI agent. The agent autonomously discovers and pays for paywalled MPP-gated data sources using Sessions (off-chain voucher-based micropayment channels), compiles the findings into a structured report, and returns it — with a full, memo-tagged spend audit trail.

The pitch in one sentence: **"Give your AI analyst a corporate card and a question."**

---

## 2. Why Tempo / Why MPP — Standout Features to Exploit

This section documents every Tempo-native primitive that makes Monitor possible. These features do not exist on any other EVM chain and are the reason this project cannot be built on Arbitrum, Base, or Optimism.

### 2.1 Tempo Protocol Primitives

| Feature | What it is | How Monitor uses it |
|---|---|---|
| **No native token** | Gas is paid in any USD-denominated TIP-20 stablecoin via an enshrined Fee AMM. No ETH dependency. Fixed base fee targeting <$0.001/transfer. | Users fund agent treasuries in USDC/pathUSD. No volatile gas token acquisition step. |
| **TIP-20 tokens** | Enshrined ERC-20 implemented as precompiles (not user-deployed bytecode). Native 32-byte transfer memos, ISO 4217 currency codes, shared compliance registry (TIP-403), built-in reward distribution. | Every agent payment carries a memo encoding `taskId:serviceId:queryIndex` for automatic audit trail reconstruction. No custom events or indexers needed. |
| **Tempo Transactions (type 0x76)** | A single tx type packing: passkey/WebAuthn signing, call batching, fee sponsorship, 2D nonces, expiring nonces, and access key delegation. | See individual rows below. |
| **Passkey authentication** | WebAuthn/biometric signing built into the tx format. No smart contract wallets, no browser extensions. | User onboarding: tap fingerprint → wallet created → treasury funded. Zero seed-phrase UX. |
| **Call batching** | Atomic multi-operation transactions. | `fundTreasury + delegateKey + startTask` in a single tx. |
| **Fee sponsorship** | A third party co-signs to pay gas on behalf of the sender. | The Monitor platform sponsors gas for agent operations so the agent's entire budget goes to data, not fees. |
| **2D nonces** | Parallel nonce lanes enabling concurrent tx submission without serial blocking. | Agent opens multiple MPP Sessions simultaneously on different nonce lanes — querying 3 data sources in parallel, not sequentially. |
| **Expiring nonces** | Time-bounded tx validity via `valid_before`/`valid_after` fields. | Agent key delegation expires when the task deadline passes. Automatic security boundary. |
| **Access key delegation** | Authorize specific keys with spending limits, contract allowlists, and expiry. | User delegates a scoped key to the agent: "spend up to X USDC, only on these MPP endpoints, expires in 2 hours." |
| **Payment lanes** | Reserved blockspace for TIP-20 transfers ensuring predictable execution during congestion. | Agent payments settle reliably even if Tempo is under load during the hackathon demo. |
| **Enshrined stablecoin DEX** | Protocol-level precompile with anti-MEV properties (fixed-rate fees, no sandwich attacks). | If agent needs to swap between stablecoins to pay a provider, it uses the enshrined DEX with guaranteed fair execution. |
| **Sub-second finality** | ~500ms deterministic finality via Simplex BFT consensus. | Treasury funding, delegation, and payment settlement all confirm in under a second. Demo feels instant. |

### 2.2 MPP (Machine Payments Protocol)

MPP is an HTTP-native payment protocol co-authored by Tempo and Stripe. It uses the HTTP 402 status code to negotiate payments inline with API requests.

**Core flow:**
1. Client requests a resource → server responds `402 Payment Required` with pricing + accepted payment methods in headers
2. Client constructs payment proof → retries request with `Authorization: Payment <proof>` header
3. Server verifies payment → returns the resource

**Two payment intents:**

| Intent | Mechanism | Latency | Monitor use case |
|---|---|---|---|
| **Charge** | One-time on-chain TIP-20 transfer with memo. ~500ms (1 block). | Per-block | Initial task setup, one-off premium report purchases |
| **Session** | Client locks funds in an on-chain escrow contract. Subsequent requests use signed off-chain vouchers verified via pure CPU. Thousands of requests per session, near-zero marginal latency. | ~0ms per request after setup | **Primary pattern.** Agent opens a Session with each data source and issues micropenny vouchers per query. This is the key demo moment. |

**Session lifecycle:**
1. `POST /sessions` → server returns session terms (price schedule, max amount)
2. Client sends on-chain tx to lock funds in escrow
3. Client includes signed vouchers in subsequent request headers
4. Server verifies voucher signature (off-chain, CPU-only)
5. Either party can close/settle on-chain at any time
6. Remaining locked funds return to client on close

**SDK ecosystem:**
- TypeScript: `mppx` (client + server), `@mppx/next` / `@mppx/hono` / `@mppx/express` / `@mppx/elysia` (framework middleware)
- Python: `pympp`
- Rust: `mpp-rs`

**MPP discovery:** Servers expose `/.well-known/mpp.json` with pricing, accepted payment methods, and session configuration.

---

## 3. Architecture — Agent Treasury + Streaming Revenue Splitter

Monitor's on-chain architecture combines two DeFi primitives adapted for Tempo:

### 3.1 Agent Treasury

A smart contract acting as a **scoped, auditable wallet for AI agents**.

```
┌──────────────────────────────────────────────────────┐
│                   MonitorTreasury.sol                 │
├──────────────────────────────────────────────────────┤
│ State:                                               │
│   owner           → user's passkey-authed address    │
│   agentKey         → delegated access key            │
│   budget           → max spend (TIP-20 amount)       │
│   spent            → running total                   │
│   deadline         → task expiry timestamp           │
│   allowedTargets[] → allowlist of MPP server addrs   │
│   taskMemo         → 32-byte task identifier         │
│                                                      │
│ Functions:                                           │
│   fundAndDelegate(amount, agentKey, deadline, targets)│
│     → batched: transfer USDC in + set key params     │
│   spend(to, amount, memo)                            │
│     → requires: msg.sender == agentKey               │
│     → requires: to ∈ allowedTargets                  │
│     → requires: spent + amount ≤ budget              │
│     → requires: block.timestamp < deadline           │
│     → executes TIP-20 transfer with memo             │
│   closeTask()                                        │
│     → callable by owner OR after deadline            │
│     → revokes agentKey, returns unspent to owner     │
│   getSpendLog() → view: returns all memo-tagged txs  │
└──────────────────────────────────────────────────────┘
```

**Key design decisions:**
- Uses Tempo's **access key delegation** at the protocol level — the agent key is authorized via the 0x76 tx type, not a Solidity modifier. The contract simply checks `msg.sender`.
- **Expiring nonces** provide a second layer: even if the contract's `deadline` check were bypassed, the agent's delegated key expires at the protocol level.
- **Fee sponsorship**: the Monitor backend co-signs agent txs to sponsor gas. The agent's budget is 100% data spend.
- **2D nonces**: the agent submits payments on parallel nonce lanes, enabling concurrent Session payments without tx ordering conflicts.

### 3.2 Revenue Splitter (Optional Extension)

If time permits, a `SplitSettlement.sol` contract can receive Session settlement payments and auto-distribute to multiple data providers proportionally. This demonstrates Tempo's call batching for atomic multi-transfer settlements.

```
┌──────────────────────────────────────────┐
│          SplitSettlement.sol              │
├──────────────────────────────────────────┤
│ recipients[] → (address, basisPoints)    │
│                                          │
│ settle(amount, memo)                     │
│   → splits TIP-20 transfer across       │
│     recipients via batched calls         │
│   → each sub-transfer carries memo       │
│     with provider attribution            │
└──────────────────────────────────────────┘
```

This is a stretch goal. The treasury is the core deliverable.

---

## 4. Monitor — Full Product Spec

### 4.1 User Journey

```
 ┌─────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
 │  USER   │────▶│  CREATE TASK │────▶│  AGENT RUNS  │────▶│   RESULTS    │
 │ (human) │     │  + FUND IT   │     │  AUTONOMOUSLY│     │  + AUDIT LOG │
 └─────────┘     └──────────────┘     └──────────────┘     └──────────────┘
      │                │                     │                     │
  passkey auth    single batched tx:    agent opens MPP       report +
  (WebAuthn)     fund treasury +        Sessions to 3-4       itemized
                 delegate key +         data sources,          spend log
                 set budget/deadline    queries w/ vouchers,   w/ memos
                                        compiles report
```

**Step-by-step:**

1. **User lands on Monitor** → authenticates via passkey (fingerprint/Face ID). Tempo wallet is created or recovered via WebAuthn. No seed phrase, no extension.

2. **User creates a task:**
   - Natural language prompt: *"Research the current state of restaking protocols. Focus on EigenLayer, Symbiotic, and Karak. Compare TVL, risk profiles, and recent governance activity."*
   - Sets budget: e.g. 2.00 USDC
   - Sets deadline: e.g. 2 hours from now
   - (Optional) selects preferred data sources from a curated list

3. **Single batched Tempo tx** (type 0x76):
   - Transfers budget from user wallet to `MonitorTreasury`
   - Delegates an access key to the agent backend with spending cap + deadline + target allowlist
   - Fee sponsored by Monitor platform (user pays $0 gas)

4. **Agent executes autonomously:**
   - Discovers available MPP data sources (hits `/.well-known/mpp.json` on each)
   - Opens MPP Sessions with 2-4 providers (parallel, using 2D nonces)
   - Issues signed vouchers per query (~$0.001–0.01 each)
   - Calls an LLM (could also be MPP-gated) to synthesize findings
   - Compiles a structured research report

5. **Agent returns results:**
   - Closes all MPP Sessions (remaining escrow returns to treasury)
   - Calls `closeTask()` to revoke its own key and return unspent budget to user
   - Delivers: research report + full spend audit log (each line item has a memo linking to the specific query and source)

6. **User reviews on dashboard:**
   - Reads the research report
   - Inspects the spend audit: which sources were queried, how much each cost, what the agent asked
   - Sees unspent budget returned to wallet

### 4.2 System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│  Next.js app with wagmi + Tempo viem extensions                 │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐    │
│  │  Task Form  │  │  Live Feed  │  │  Report + Audit View │    │
│  │  (create +  │  │  (agent     │  │  (results + spend    │    │
│  │   fund)     │  │   activity) │  │   breakdown)         │    │
│  └─────────────┘  └─────────────┘  └──────────────────────┘    │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST / WebSocket
┌────────────────────────────▼────────────────────────────────────┐
│                      BACKEND (Node.js)                          │
│  ┌────────────────┐  ┌────────────────┐  ┌─────────────────┐   │
│  │  Task Manager  │  │  Agent Engine  │  │  MPP Client     │   │
│  │  (CRUD, state  │  │  (LLM orchestr │  │  (mppx Sessions │   │
│  │   machine)     │  │   + tool calls) │  │   + vouchers)   │   │
│  └────────────────┘  └────────────────┘  └─────────────────┘   │
│  ┌────────────────┐  ┌────────────────┐                        │
│  │  Tempo Client  │  │  Fee Sponsor   │                        │
│  │  (viem + 0x76  │  │  (co-signs     │                        │
│  │   tx builder)  │  │   agent txs)   │                        │
│  └────────────────┘  └────────────────┘                        │
└────────────────────────────┬────────────────────────────────────┘
                             │ RPC + MPP HTTP
┌────────────────────────────▼────────────────────────────────────┐
│                      TEMPO CHAIN                                │
│  ┌────────────────────────┐  ┌──────────────────────────────┐   │
│  │  MonitorTreasury.sol   │  │  MPP Session Escrows         │   │
│  │  (budget, delegation,  │  │  (locked funds per session,  │   │
│  │   spend tracking)      │  │   voucher settlement)        │   │
│  └────────────────────────┘  └──────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                             │ MPP Sessions (HTTP 402)
┌────────────────────────────▼────────────────────────────────────┐
│                  MPP DATA PROVIDERS (mock)                       │
│  ┌──────────────┐ ┌──────────────┐ ┌───────────────────────┐   │
│  │ DeFi Stats   │ │ News Feed    │ │ On-chain Analytics     │   │
│  │ API          │ │ API          │ │ API                    │   │
│  │ $0.005/query │ │ $0.002/query │ │ $0.01/query            │   │
│  └──────────────┘ └──────────────┘ └───────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Smart Contracts

#### MonitorTreasury.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// NOTE: TIP-20 tokens are precompiles on Tempo, not standard ERC-20.
// Use Tempo's viem extensions or the TIP-20 precompile interface
// for transfers. The interface below is illustrative — adapt to
// the actual Tempo precompile ABI from docs.tempo.xyz/protocol/tip20/spec

interface ITIP20 {
    function transferWithMemo(address to, uint256 amount, bytes32 memo) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract MonitorTreasury {

    // --- Types ---

    struct Task {
        address owner;           // passkey-authed user address
        address agentKey;        // delegated agent key
        address token;           // TIP-20 stablecoin (USDC/pathUSD)
        uint256 budget;          // max spend
        uint256 spent;           // running total
        uint256 deadline;        // unix timestamp — key expires here too
        bytes32 taskMemo;        // 32-byte task identifier
        bool active;
    }

    // --- State ---

    mapping(bytes32 => Task) public tasks;           // taskId => Task
    mapping(bytes32 => address[]) public allowedTargets; // taskId => MPP provider allowlist
    mapping(bytes32 => SpendEntry[]) public spendLog;    // taskId => audit trail

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
    /// @dev In production, fundAndDelegate would be called via a batched 0x76 tx
    ///      that also sets up access key delegation at the protocol level.
    ///      The contract-level checks below are a defense-in-depth layer.
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
        ITIP20(token).transfer(address(this), budget); // user must have approved

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

    /// @notice Agent spends from the task budget. Called by the delegated agent key.
    /// @param taskId The task to spend from
    /// @param to The MPP provider address (must be in allowlist)
    /// @param amount Amount of TIP-20 to transfer
    /// @param memo 32 bytes: packed serviceId (16 bytes) + queryIndex (16 bytes)
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

    /// @notice Close the task. Revokes agent access, returns unspent funds.
    /// @dev Callable by owner at any time, or by anyone after deadline.
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

        // NOTE: access key revocation happens at the protocol level
        // via the 0x76 tx. The contract marks inactive as defense-in-depth.

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

**Deployment notes:**
- Deploy to Tempo mainnet or testnet via Foundry (Tempo is EVM-compatible, standard `forge create` works)
- TIP-20 precompile addresses for USDC/pathUSD are documented at `docs.tempo.xyz/protocol/tip20/spec`
- The `transferWithMemo` interface must be adapted to Tempo's actual precompile ABI — check the viem extensions in `@tempo-xyz/viem`

#### Mock MPP Data Providers

For the hackathon, build 3 lightweight MPP servers using `@mppx/hono` or `@mppx/express`:

**Provider 1: DeFi Stats API** (`defi-stats`)
- `GET /protocols/:name/tvl` → returns TVL data
- `GET /protocols/:name/risk` → returns risk score
- Session pricing: $0.005/query
- Returns mock but realistic JSON

**Provider 2: News Feed API** (`news-feed`)
- `GET /search?q=:topic&days=:n` → returns news articles
- `GET /article/:id` → returns full article text
- Session pricing: $0.002/query
- Returns mock articles with realistic metadata

**Provider 3: On-chain Analytics API** (`chain-analytics`)
- `GET /governance/:protocol/proposals` → returns recent proposals
- `GET /wallets/:address/activity` → returns tx summary
- Session pricing: $0.01/query
- Returns mock on-chain data

Each provider:
- Serves `/.well-known/mpp.json` with pricing + session config
- Uses `@mppx/hono` middleware for 402 challenge/response
- Accepts MPP Session vouchers for per-query payment
- Logs received payments with memos for demo visibility

### 4.4 Backend — Agent Engine

The backend is a Node.js service (TypeScript) with these responsibilities:

**Task Manager:**
- Receives task creation requests from the frontend
- Builds and submits the batched 0x76 Tempo tx (fund + delegate + create)
- Manages task lifecycle state machine: `CREATED → FUNDING → RUNNING → COMPILING → COMPLETE | FAILED`
- Pushes status updates to frontend via WebSocket

**Agent Engine:**
- Receives the research prompt + budget + data source list
- Calls Claude (or another LLM) with a system prompt containing:
  - The research question
  - Available MPP data sources and their schemas
  - Budget constraints
  - Output format requirements
- Uses tool-calling to let the LLM decide which APIs to query and in what order
- Each tool call triggers an MPP Session query (see MPP Client below)
- After all queries complete, calls the LLM again with all gathered data to synthesize the report

**MPP Client (`mppx`):**
- For each data source, opens an MPP Session:
  1. `GET /.well-known/mpp.json` → discover pricing
  2. `POST /sessions` → negotiate session terms
  3. Submit on-chain escrow tx (via treasury's `spend` function for the lock amount)
  4. For each query: sign a voucher, attach as `Authorization: Payment <voucher>` header
- Uses **2D nonces** to open multiple Sessions in parallel (one per nonce lane)
- On task completion: close all Sessions, settle on-chain

**Fee Sponsor:**
- Holds a funded Tempo account
- Co-signs all agent-initiated 0x76 txs to cover gas
- Simple: just a wallet with a co-signing endpoint

### 4.5 Frontend — Technical Spec

**Stack:** Next.js 14+ (App Router), React, TypeScript, Tailwind CSS, wagmi + `@tempo-xyz/viem` for chain interaction.

**Auth:** Tempo passkey integration via wagmi's WebAuthn connector. User taps fingerprint → wallet ready. No MetaMask, no seed phrase.

The frontend has **three main views** plus a persistent layout shell:

---

#### Layout Shell

- Top bar with Monitor wordmark/logo, connected wallet address (truncated), USDC balance, and a passkey auth button (shows "Tap to connect" or biometric icon)
- Subtle animated indicator when an agent is actively running

---

#### View 1: Task Creation (`/`)

**Purpose:** User describes their research task and sets a budget.

**Components:**

1. **Research prompt textarea** — large, prominent. Placeholder: *"What do you want to know?"*. Supports multi-line. No character limit but displays a "complexity estimate" badge as user types (simple heuristic based on length + detected entity count).

2. **Budget selector** — horizontal slider or segmented control. Presets: $0.50 / $1.00 / $2.00 / $5.00, plus custom input. Shows estimated query count based on average provider pricing (e.g. "$2.00 ≈ ~200 queries across 3 sources").

3. **Deadline selector** — simple toggle: 30 min / 1 hour / 2 hours. Default: 1 hour.

4. **Data sources panel** — shows the 3 available mock providers with name, description, price-per-query. All selected by default. User can deselect any.

5. **"Deploy Agent" button** — triggers the batched Tempo tx. On click:
   - Show passkey biometric prompt (fingerprint/Face ID)
   - On signature: show brief tx confirmation (amount, deadline, sources)
   - Transition to Live Feed view

**State:** Form data stored in React state. On submit, POST to backend `/api/tasks` with `{ prompt, budget, deadline, sources }`.

---

#### View 2: Live Feed (`/task/:taskId`)

**Purpose:** Real-time view of agent activity while the task is running.

**Components:**

1. **Status header** — shows task state (FUNDING → RUNNING → COMPILING → COMPLETE), elapsed time, budget spent/remaining as an animated progress bar.

2. **Activity feed** — chronological list of agent actions, streamed via WebSocket. Each entry shows:
   - Timestamp
   - Action type icon (🔍 query, 💰 payment, 🤖 reasoning, 📝 compiling)
   - Description: e.g. *"Opened Session with DeFi Stats API ($0.50 escrow)"*, *"Queried /protocols/eigenlayer/tvl — $0.005"*, *"Synthesizing findings from 47 queries..."*
   - Running spend total after each payment

3. **Source status cards** — one card per data source showing: connection status (connecting / active session / closed), queries made, amount spent, mini sparkline of query frequency.

4. **Budget burn chart** — simple area chart showing cumulative spend over time. X-axis: elapsed time. Y-axis: USDC. Shows budget ceiling as a dotted line.

5. **Emergency stop button** — calls `closeTask()`, immediately revokes agent key and returns unspent budget.

**Data flow:** WebSocket connection to backend `/ws/tasks/:taskId`. Backend pushes events: `{ type: "query" | "payment" | "reasoning" | "session_open" | "session_close" | "complete", data: {...} }`.

---

#### View 3: Results + Audit (`/task/:taskId/results`)

**Purpose:** Display the research report and the itemized spend audit.

**Components:**

1. **Report panel** (left/main, ~65% width) — rendered Markdown of the agent's research report. Sections correspond to the research prompt's topics. Each claim is annotated with the source it came from (linked to the audit log entry).

2. **Audit panel** (right sidebar, ~35% width) — itemized spend log pulled from on-chain `getSpendLog()`. Each entry shows:
   - Provider name + icon
   - Query description (decoded from memo)
   - Amount paid
   - Tempo tx hash (linked to explorer)
   - Timestamp
   
   Summary at top: total spent, total refunded, number of queries, cost per query average.

3. **Refund confirmation** — if unspent budget was returned, show a green banner: *"$X.XX returned to your wallet"* with tx hash.

4. **"New Task" button** — returns to task creation view.

---

#### Design Direction

**Aesthetic:** Terminal-meets-Bloomberg. Dark background (#0a0a0a), monospace type for data/numbers (JetBrains Mono or similar), clean sans-serif for prose (Satoshi, General Sans, or similar). Accent color: electric green (#00ff88) for active/success states, amber (#ffaa00) for pending, muted for inactive. The vibe is "mission control for your AI analyst" — information-dense but not cluttered. Think: a trader's terminal redesigned by a good design studio.

**Key interactions:**
- Passkey auth should feel instant — fingerprint tap → wallet connected in <1s
- Task creation tx should show a satisfying confirmation animation (the budget "flowing" into the treasury)
- Live feed should feel alive — entries animate in, spend counter ticks up in real-time
- Audit log entries should be clickable → expand to show full memo bytes + decoded fields

**Responsive:** Desktop-first for the hackathon. Tablet-friendly layout (stack report + audit vertically). Mobile: simplified live feed only.

---

### 4.6 Data Models

**Task (backend state):**
```typescript
interface Task {
  id: string;                    // uuid
  taskId: bytes32;               // on-chain task identifier
  owner: Address;                // user's Tempo address
  agentKey: Address;             // delegated agent key
  prompt: string;                // research question
  budget: bigint;                // in token smallest unit
  spent: bigint;                 // running total
  deadline: number;              // unix timestamp
  sources: DataSource[];         // selected MPP providers
  status: 'created' | 'funding' | 'running' | 'compiling' | 'complete' | 'failed';
  report?: string;               // markdown report (set on completion)
  spendLog: SpendEntry[];        // mirrors on-chain log
  createdAt: number;
  completedAt?: number;
}

interface DataSource {
  id: string;                    // e.g. "defi-stats"
  name: string;
  baseUrl: string;
  pricePerQuery: number;         // in USD
  sessionConfig: MPPSessionConfig;
}

interface SpendEntry {
  target: Address;
  amount: bigint;
  memo: bytes32;
  decodedMemo: {
    serviceId: string;
    queryIndex: number;
  };
  timestamp: number;
  txHash: string;
}
```

**WebSocket events:**
```typescript
type WSEvent =
  | { type: 'status_change'; status: Task['status'] }
  | { type: 'session_open'; sourceId: string; escrowAmount: bigint }
  | { type: 'query'; sourceId: string; endpoint: string; cost: bigint; memo: bytes32 }
  | { type: 'reasoning'; message: string }
  | { type: 'session_close'; sourceId: string; spent: bigint; refunded: bigint }
  | { type: 'report_ready'; report: string }
  | { type: 'task_complete'; totalSpent: bigint; totalRefunded: bigint };
```

---

## 5. What the Judges Likely Care About

The hackathon is a launch-day event for MPP on Tempo mainnet, co-hosted by Stripe. Judging almost certainly weights:

1. **MPP integration depth** — Projects that use both Charge AND Session, or demonstrate novel payment flows, will score higher than simple 402-gated endpoints. Monitor uses Sessions as its primary pattern with dozens of voucher-authenticated queries per task. This is deep MPP usage.

2. **Tempo-native feature coverage** — Passkeys, fee sponsorship, memos, call batching, 2D nonces. Features that don't exist on other chains. Monitor uses all six: passkey auth, fee-sponsored agent txs, memo-tagged spend audit, batched task creation, parallel nonce lanes for concurrent Sessions, and expiring nonces for automatic security boundaries.

3. **Real-world applicability** — The design partners (Anthropic, OpenAI, Shopify, DoorDash) signal that practical commerce use cases matter more than pure DeFi plays. Monitor is a concrete product: "give an AI agent a budget to do research for you." Everyone understands this.

4. **Demo quality** — In a compressed HIIT format, a crisp working demo beats ambitious-but-broken. Monitor's demo arc is clean: type a question → tap fingerprint → watch the agent work in real-time → read the report → inspect the spend audit. Every step is visual and satisfying.

5. **Novelty over existing MPP services** — The 100+ launch-day services are mostly simple Charge-gated APIs. Monitor is a *consumer of* MPP services, not another MPP service. It demonstrates the ecosystem working together: multiple providers, Sessions, autonomous agent spending, on-chain audit. This is the "so what?" answer for the entire MPP launch.

6. **Agent narrative alignment** — Tempo's core positioning is "the blockchain for AI agent payments." Monitor is literally an AI agent paying for things. The Prospect Butcher showcase (agents ordering sandwiches) set this tone. Monitor extends it: agents don't just buy sandwiches, they conduct research, manage budgets, and produce auditable work product.

**Demo script (suggested, ~3 minutes):**
1. (30s) "This is Monitor. You give an AI agent a research question and a budget. It pays for the answers." Show the task creation form.
2. (20s) Type a research prompt. Set $2 budget. Tap fingerprint. Show the batched tx confirming in <1s.
3. (60s) Watch the live feed. Narrate: "The agent just opened 3 MPP Sessions in parallel using Tempo's 2D nonces. Each query costs a fraction of a cent, paid via off-chain vouchers. Watch the budget burn in real-time."
4. (30s) Results land. Show the report. "47 queries across 3 sources. Total cost: $1.23. $0.77 returned to my wallet."
5. (30s) Flip to the audit panel. "Every penny is accounted for on-chain. Each payment carries a memo linking it to the exact query. This is the agent's expense report."
6. (10s) "Monitor runs on Tempo because no other chain has the primitives: passkey auth, fee sponsorship, 2D nonces, native memos, sub-second finality, and MPP Sessions. This couldn't exist anywhere else."

---

## 6. Build Plan — Weekend Scope

### Priority 1: Core (must ship)
- [ ] `MonitorTreasury.sol` — deploy to Tempo testnet/mainnet
- [ ] 2-3 mock MPP data providers (Hono + `@mppx/hono`)
- [ ] Agent engine: LLM orchestration with tool-calling that queries MPP providers via Sessions
- [ ] Frontend: task creation → live feed → results view
- [ ] Passkey auth integration via wagmi + Tempo WebAuthn connector
- [ ] Batched 0x76 tx for task creation (fund + delegate)

### Priority 2: Demo polish (should ship)
- [ ] Fee sponsorship for agent txs
- [ ] Memo encoding/decoding (taskId:serviceId:queryIndex)
- [ ] Budget burn chart on live feed
- [ ] On-chain spend log retrieval + display in audit panel
- [ ] 2D nonce usage for parallel Session opens

### Priority 3: Stretch goals (nice to have)
- [ ] `SplitSettlement.sol` for multi-provider revenue distribution
- [ ] Expiring nonce demonstration (show key auto-expiry after deadline)
- [ ] Multiple concurrent tasks
- [ ] Provider discovery via `/.well-known/mpp.json` scanning
- [ ] Mobile-responsive layout

### Tech Stack Summary
| Layer | Technology |
|---|---|
| Frontend | Next.js 14+, React, TypeScript, Tailwind CSS, wagmi, @tempo-xyz/viem |
| Backend | Node.js, TypeScript, Hono or Express |
| Agent | Claude API (or any LLM with tool-calling) |
| MPP Client | `mppx` (TypeScript SDK) |
| MPP Servers | `@mppx/hono` middleware on Hono |
| Smart Contracts | Solidity 0.8.24+, Foundry for deploy/test |
| Chain | Tempo mainnet (or testnet if available) |
| Auth | Passkeys via Tempo's WebAuthn tx signing |
| Real-time | WebSocket (native Node.js or Socket.io) |

---

## 7. Key Risks + Mitigations

| Risk | Mitigation |
|---|---|
| TIP-20 precompile interface differs from illustrative spec above | Read actual ABI from `docs.tempo.xyz/protocol/tip20/spec` before writing contract. Adapt `transferWithMemo` signature. |
| Passkey/WebAuthn connector not stable on day-1 mainnet | Fall back to standard EOA signing via private key. Passkey is a demo enhancement, not a blocker. |
| MPP Session SDK has undocumented quirks | Start with Charge (simpler) as fallback. Sessions are the demo highlight but Charge still shows MPP integration. |
| 2D nonces are complex to manage in application code | If parallel Session opens fail, serialize them. Mention 2D nonces in the pitch even if demo is sequential. |
| Fee sponsorship co-signing flow is underdocumented | Pre-fund the agent key with a small gas balance as fallback. Sponsorship is a talking point even if implemented as a simple pre-fund. |
| LLM tool-calling adds latency and unpredictability | Pre-script the agent's query plan for the demo. Let it be autonomous in testing, but have a deterministic fallback for the live demo. |

---

*Built for the Tempo × Stripe HIIT Hackathon, March 2026.*
