// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MonitorTreasury.sol";
import "../src/interfaces/ISignatureTransfer.sol";
import "../src/interfaces/IERC20.sol";

/**
 * @title E2ESmokeTest
 * @dev Creates a fresh smoke-test task on MonitorTreasury and authorizes the Tempo wallet.
 *
 * Uses nonce=1 (nonce=0 was consumed by AuthorizeAgent.s.sol in monitor-j4qhk).
 * Task ID: keccak256("monitor-e2e-smoke-test")
 * Budget: 50,000 USDC.e (0.05 USDC)
 *
 * Environment:
 *   PRIVATE_KEY       Deployer EOA private key
 *   TREASURY_ADDRESS  Deployed MonitorTreasury
 *   AGENT_ADDRESS     Tempo wallet address to authorize
 */
contract E2ESmokeTest is Script {
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

        // E2E smoke test task params
        bytes32 taskId     = keccak256("monitor-e2e-smoke-test");
        uint256 budget     = 50_000; // 0.05 USDC (6 dec)
        uint256 taskTtl    = 86400;  // 1 day
        uint256 nonce      = 1;      // nonce 0 consumed by AuthorizeAgent
        uint256 deadline   = block.timestamp + 1 hours;

        console.log("=== E2E Smoke Test ===");
        console.log("Treasury:", treasuryAddr);
        console.log("Token (USDC.e):", tokenAddr);
        console.log("Permit2:", permit2Addr);
        console.log("Task ID:", vm.toString(taskId));
        console.log("Budget:", budget, "USDC.e microunits");
        console.log("Agent:", agentAddr);

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

        // Step 1: Approve Permit2 (idempotent)
        IERC20(tokenAddr).approve(permit2Addr, type(uint256).max);
        console.log("Step 1: Permit2 approved");

        // Step 2: Create task (pulls USDC via Permit2)
        treasury.createTask(taskId, budget, taskTtl, permit, sig);
        console.log("Step 2: Task created on-chain");

        // Step 3: Authorize agent
        treasury.authorizeAgent(taskId, agentAddr);
        console.log("Step 3: Agent authorized");

        // Step 4: Verify on-chain state
        bool isAuth = treasury.isAuthorizedAgent(taskId, agentAddr);
        console.log("Step 4: isAuthorizedAgent:", isAuth);

        vm.stopBroadcast();

        console.log("=== E2E Smoke Test COMPLETE ===");
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
