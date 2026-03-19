// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MonitorTreasury.sol";
import "../src/interfaces/ISignatureTransfer.sol";
import "../src/interfaces/IERC20.sol";

/**
 * @title AuthorizeAgent
 * @dev Creates a demo task and authorizes a Tempo wallet address as agent.
 *
 * Demonstrates the full Permit2 flow on-chain:
 *   1. Approve Permit2 to spend the deployer's USDC
 *   2. Sign a PermitTransferFrom (EIP-712) for the budget amount
 *   3. Call createTask() — pulls USDC atomically via Permit2
 *   4. Call authorizeAgent() — grants Tempo wallet spending rights
 *
 * Environment variables:
 *   PRIVATE_KEY        Deployer EOA key (owns the contract)
 *   TREASURY_ADDRESS   Deployed MonitorTreasury address
 *   AGENT_ADDRESS      Address to authorize (e.g. Tempo wallet)
 */
contract AuthorizeAgent is Script {
    // Permit2 EIP-712 type hashes (canonical)
    bytes32 constant TOKEN_PERMISSIONS_TYPEHASH =
        keccak256("TokenPermissions(address token,uint256 amount)");
    bytes32 constant PERMIT_TRANSFER_FROM_TYPEHASH =
        keccak256("PermitTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline)"
                  "TokenPermissions(address token,uint256 amount)");

    function run() external {
        uint256 privKey      = vm.envUint("PRIVATE_KEY");
        address treasuryAddr = vm.envAddress("TREASURY_ADDRESS");
        address agentAddr    = vm.envAddress("AGENT_ADDRESS");

        MonitorTreasury treasury = MonitorTreasury(treasuryAddr);
        address permit2Addr = address(treasury.PERMIT2());
        address tokenAddr   = address(treasury.TOKEN());

        // Task params
        bytes32 taskId     = keccak256("monitor-agent-auth-demo");
        uint256 budget     = 100_000; // 0.1 USDC (6 dec)
        uint256 taskTtl    = 86400;   // 1 day
        uint256 nonce      = 0;
        uint256 deadline   = block.timestamp + 1 hours;

        bytes memory sig = _signPermit(privKey, permit2Addr, tokenAddr, treasuryAddr, budget, nonce, deadline);

        ISignatureTransfer.PermitTransferFrom memory permit =
            ISignatureTransfer.PermitTransferFrom({
                permitted: ISignatureTransfer.TokenPermissions({
                    token:  tokenAddr,
                    amount: budget
                }),
                nonce:    nonce,
                deadline: deadline
            });

        vm.startBroadcast(privKey);

        // 1. Approve Permit2 to spend tokens (one-time; idempotent)
        IERC20(tokenAddr).approve(permit2Addr, type(uint256).max);
        console.log("Permit2 approved for token:", tokenAddr);

        // 2. Create task (pulls USDC via Permit2 atomically)
        treasury.createTask(taskId, budget, taskTtl, permit, sig);
        console.log("Task created:", vm.toString(taskId));

        // 3. Authorize Tempo wallet as agent
        treasury.authorizeAgent(taskId, agentAddr);
        console.log("Agent authorized:", agentAddr);

        vm.stopBroadcast();
    }

    function _signPermit(
        uint256 privKey,
        address permit2Addr,
        address tokenAddr,
        address spender,
        uint256 amount,
        uint256 nonce,
        uint256 deadline
    ) internal view returns (bytes memory) {
        bytes32 domainSep = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)"),
            keccak256("Permit2"),
            block.chainid,
            permit2Addr
        ));
        bytes32 tokenPermHash = keccak256(abi.encode(TOKEN_PERMISSIONS_TYPEHASH, tokenAddr, amount));
        bytes32 msgHash = keccak256(abi.encode(PERMIT_TRANSFER_FROM_TYPEHASH, tokenPermHash, spender, nonce, deadline));
        bytes32 digest  = keccak256(abi.encodePacked("\x19\x01", domainSep, msgHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privKey, digest);
        return abi.encodePacked(r, s, v);
    }
}
