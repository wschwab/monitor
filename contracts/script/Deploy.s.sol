// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MonitorTreasury.sol";

/**
 * @title Deploy
 * @dev Deployment script for MonitorTreasury contract.
 *
 * Environment variables:
 * - TEMPO_RPC_URL: RPC endpoint for Tempo testnet
 * - PRIVATE_KEY: Deployer private key
 */
contract Deploy is Script {
    function run() external {
        // Load private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Start broadcast
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy MonitorTreasury
        MonitorTreasury treasury = new MonitorTreasury();
        
        // Log deployment
        console.log("MonitorTreasury deployed at:", address(treasury));
        console.log("Owner:", treasury.owner());
        
        vm.stopBroadcast();
    }
}