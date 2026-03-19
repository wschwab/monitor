// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MonitorTreasury.sol";

/**
 * @title Deploy
 * @dev Deployment script for MonitorTreasury (Permit2 / USDC variant).
 *
 * Environment variables:
 * - TEMPO_RPC_URL:   RPC endpoint for Tempo mainnet
 * - PRIVATE_KEY:     Deployer private key
 * - USDC_ADDRESS:    TIP-20 USDC token address (default: Tempo USDC.e)
 * - PERMIT2_ADDRESS: Canonical Permit2 address (default: 0x000000000022D473030F116dDEE9F6B43aC78BA3)
 */
contract Deploy is Script {
    // Tempo mainnet USDC.e
    address constant DEFAULT_USDC   = 0x20C000000000000000000000b9537d11c60E8b50;
    // Canonical Permit2 (same on all EVM chains)
    address constant DEFAULT_PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        address usdc    = vm.envOr("USDC_ADDRESS",    DEFAULT_USDC);
        address permit2 = vm.envOr("PERMIT2_ADDRESS", DEFAULT_PERMIT2);

        vm.startBroadcast(deployerPrivateKey);

        MonitorTreasury treasury = new MonitorTreasury(usdc, permit2);

        console.log("MonitorTreasury deployed at:", address(treasury));
        console.log("Owner  :", treasury.OWNER());
        console.log("Token  :", address(treasury.TOKEN()));
        console.log("Permit2:", address(treasury.PERMIT2()));

        vm.stopBroadcast();
    }
}
