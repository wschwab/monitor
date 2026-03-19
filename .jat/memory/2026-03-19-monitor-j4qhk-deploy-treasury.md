---
task: monitor-j4qhk
agent: Hououin
project: monitor
completed: 2026-03-19
files:
  - contracts/src/MonitorTreasury.sol
  - contracts/src/interfaces/IERC20.sol
  - contracts/src/interfaces/ISignatureTransfer.sol
  - contracts/script/Deploy.s.sol
  - contracts/script/AuthorizeAgent.s.sol
  - contracts/test/MonitorTreasury.t.sol
  - contracts/test/mocks/MockERC20.sol
  - contracts/test/mocks/MockPermit2.sol
  - contracts/foundry.toml
  - .env.example
tags: [solidity, tempo, permit2, usdc, deployment, foundry]
labels: [contracts, deploy]
priority: 2
type: task
---

## Summary

Deployed MonitorTreasury to Tempo mainnet (chain 4217). Discovered that the original ETH/`msg.value` design is incompatible with Tempo ("value transfer not allowed"), rewrote the contract to use Permit2 + USDC, redeployed, verified, and confirmed agent authorization on-chain.

**Final contract address:** `0x95c9009c82FEd445dEDeecEfC2abA6edEb920941`

## Approach

1. Attempted deployment of original `msg.value` contract → failed with "max_fee_per_gas below minimum"
2. Installed Tempo Foundry fork (`foundryup -n tempo`) — required for `--tempo.fee-token` flag
3. Transferred USDC from Tempo wallet to deployer key for gas (Tempo has no native token)
4. Deployed original contract → succeeded, but `createTask` unusable ("value transfer not allowed")
5. Rewrote contract: `msg.value` budget → Permit2 `permitTransferFrom`, ETH transfers → `IERC20.transfer`
6. TDD: wrote failing tests first, confirmed RED, implemented GREEN
7. Redeployed Permit2 version, verified, ran `AuthorizeAgent.s.sol` end-to-end on mainnet

## Decisions

- **Permit2 over standard approve+transferFrom**: single-step UX — user signs one off-chain message, no prior approve transaction needed. Canonical Permit2 (`0x000000000022D473030F116dDEE9F6B43aC78BA3`) is live on Tempo.
- **`via_ir = true` in foundry.toml**: needed for `AuthorizeAgent.s.sol` (stack depth with multiple local vars). Does not affect test results.
- **`InvalidToken` error**: guard in `createTask` to reject permits using wrong ERC-20, preventing silent budget misaccounting.
- **`MockPermit2` in tests**: skips sig verification, exercises full contract logic end-to-end in unit tests without needing real secp256k1 signatures.

## Key Files

| File | Purpose |
|------|---------|
| `contracts/src/MonitorTreasury.sol` | Rewritten: constructor takes `(token, permit2)`, createTask uses Permit2 |
| `contracts/src/interfaces/ISignatureTransfer.sol` | Minimal Permit2 interface (PermitTransferFrom, SignatureTransferDetails) |
| `contracts/script/AuthorizeAgent.s.sol` | Signs Permit2 EIP-712 digest with vm.sign, creates task, authorizes agent |
| `contracts/test/mocks/MockPermit2.sol` | Test stub: skips sig verification, executes transferFrom |
| `.env.example` | TREASURY_ADDRESS and all config vars, safe to commit |

## Key Addresses (Tempo mainnet, chain 4217)

| Name | Address |
|------|---------|
| MonitorTreasury (Permit2) | `0x95c9009c82FEd445dEDeecEfC2abA6edEb920941` |
| USDC.e token | `0x20C000000000000000000000b9537d11c60E8b50` |
| Permit2 (canonical) | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| Deployer / contract owner | `0xc88D3C73B71e6814785a0514aF9ddcFA44aA93cF` |
| Tempo wallet (authorized agent) | `0x016bbbec8fb7cf59c0baa082f056eb650368051d` |

## Lessons

- **Tempo has no native gas token**: `eth_getBalance` always returns a fake large number (chain design). Fees are paid in USDC via TIP-20. Standard Foundry fails; use Tempo fork.
- **`msg.value` is dead on Tempo**: any transaction with non-zero `value` is rejected at protocol level. All token flows must use ERC-20 (`transferFrom` / Permit2).
- **Permit2 signing in forge scripts**: use `vm.sign` with manually computed EIP-712 digest. Domain separator = `keccak256(abi.encode(domainTypeHash, keccak256("Permit2"), block.chainid, permit2Addr))`.
- **Tempo Foundry fork install**: `foundryup -n tempo` (requires updated foundryup via `foundryup -U` first).
- **Gas funding**: deployer key needs USDC for gas. Use `tempo wallet transfer <amount> <token> <to>` to fund from wallet. No prior approve needed (access key handles it).
