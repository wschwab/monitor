---
task: monitor-qlk0a
agent: Sisyphus
project: monitor
completed: 2026-03-19
files:
  - contracts/src/MonitorTreasury.sol
  - contracts/test/MonitorTreasury.t.sol
  - contracts/script/Deploy.s.sol
  - .sisyphus/evidence/monitor-qlk0a-red.txt
  - .sisyphus/evidence/monitor-qlk0a-green.txt
tags:
  - solidity
  - tdd
  - treasury
  - smart-contract
labels:
  - wave-2
  - tdd-compliant
priority: P1
type: task
---

# Implement and Test MonitorTreasury Contract

## Summary

Implemented MonitorTreasury.sol with full budget/deadline/agent enforcement using TDD workflow. 25 Foundry tests all passing.

## TDD Workflow

### RED Phase
- Wrote 25 comprehensive Foundry tests first
- Tests covered: createTask, spend, recordSpend, closeTask, authorization
- Evidence saved to monitor-qlk0a-red.txt (compilation failed as expected)

### GREEN Phase
- Implemented MonitorTreasury.sol with all required functionality
- All 25 tests passed
- Evidence saved to monitor-qlk0a-green.txt

## Contract Features

### Functions
- `createTask(taskId, budget, deadlineOffset)` - Creates task with ETH budget
- `authorizeAgent(taskId, agent)` - Authorizes spending agent
- `revokeAgent(taskId, agent)` - Revokes agent authorization
- `spend(taskId, recipient, amount, memo)` - Transfers funds with enforcement
- `recordSpend(taskId, recipient, amount, memo)` - Tracks off-chain spend
- `recordSpend(taskId, recipient, amount, memo, idempotencyKey)` - With idempotency
- `closeTask(taskId)` - Closes task and refunds remaining budget

### Enforcement
- Budget: Rejects spend exceeding remaining budget
- Deadline: Rejects spend after deadline timestamp
- Status: Only active tasks allow spend
- Authorization: Only owner or authorized agents can spend
- Idempotency: Duplicate keys rejected for recordSpend

### Custom Errors (Gas Efficient)
```solidity
error TaskExists();
error BudgetMismatch();
error ZeroBudget();
error Unauthorized();
error TaskInactive();
error DeadlinePassed();
error BudgetExceeded();
error NotOwner();
error DuplicateIdempotency();
error TransferFailed();
```

## Gas Usage

- createTask: ~117k gas
- authorizeAgent: ~143k gas
- spend: ~206k gas
- recordSpend: ~175k gas
- closeTask: ~108k gas

## Deployment

```bash
export TEMPO_RPC_URL=https://rpc.tempo.network
export PRIVATE_KEY=0x...
forge script script/Deploy.s.sol --rpc-url $TEMPO_RPC_URL --broadcast
```

## Test Coverage

25 tests covering:
- Task creation (budget transfer, storage, validations)
- Spending (authorization, budget, deadline, status)
- Record spend (tracking, idempotency)
- Task closure (refund, status)
- Authorization (grant, revoke)
- View functions (remaining budget, total spent)

## Next Steps

Task 5 (monitor-uefax) - Build proxy foundation:
- Use MonitorTreasury for premium provider billing
- Integrate contract address in backend config