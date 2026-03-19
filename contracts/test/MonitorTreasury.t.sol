// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MonitorTreasury.sol";

/**
 * @title MonitorTreasuryTest
 * @dev Comprehensive tests for MonitorTreasury contract.
 *
 * TDD: These tests MUST fail initially (RED phase), then pass after implementation (GREEN phase).
 */
contract MonitorTreasuryTest is Test {
    MonitorTreasury public treasury;
    
    // Test accounts
    address public owner = address(1);
    address public user = address(2);
    address public agent = address(3);
    address public unauthorized = address(4);
    address public serviceProvider = address(5);
    
    // Test values
    uint256 public constant BUDGET = 1 ether;
    uint256 public constant DEADLINE_SECONDS = 1 hours;
    bytes32 public constant TASK_ID = keccak256("test-task-1");
    bytes32 public constant MEMO = keccak256("test-memo");

    function setUp() public {
        vm.startPrank(owner);
        treasury = new MonitorTreasury();
        vm.stopPrank();
        
        // Fund user account
        vm.deal(user, 10 ether);
        vm.deal(agent, 1 ether);
    }

    // =========================================================================
    // Create Task Tests
    // =========================================================================

    function test_CreateTask_TransfersBudgetFromUser() public {
        vm.startPrank(user);
        
        uint256 userBalanceBefore = user.balance;
        
        treasury.createTask{value: BUDGET}(TASK_ID, BUDGET, DEADLINE_SECONDS);
        
        uint256 userBalanceAfter = user.balance;
        
        assertEq(userBalanceBefore - userBalanceAfter, BUDGET, "Budget should be transferred from user");
        vm.stopPrank();
    }

    function test_CreateTask_StoresTaskDetails() public {
        vm.startPrank(user);
        
        treasury.createTask{value: BUDGET}(TASK_ID, BUDGET, DEADLINE_SECONDS);
        
        (address taskOwner, uint256 budget, uint256 spent, uint256 deadline, bool active) = treasury.getTask(TASK_ID);
        
        assertEq(taskOwner, user, "Task owner should be caller");
        assertEq(budget, BUDGET, "Budget should match");
        assertEq(spent, 0, "Initial spent should be 0");
        assertGt(deadline, block.timestamp, "Deadline should be in future");
        assertEq(deadline, block.timestamp + DEADLINE_SECONDS, "Deadline should be offset from now");
        assertTrue(active, "Task should be active");
        
        vm.stopPrank();
    }

    function test_CreateTask_RevertsIfTaskExists() public {
        vm.startPrank(user);
        
        treasury.createTask{value: BUDGET}(TASK_ID, BUDGET, DEADLINE_SECONDS);
        
        vm.expectRevert(MonitorTreasury.TaskExists.selector);
        treasury.createTask{value: BUDGET}(TASK_ID, BUDGET, DEADLINE_SECONDS);
        
        vm.stopPrank();
    }

    function test_CreateTask_RevertsIfBudgetMismatch() public {
        vm.startPrank(user);
        
        vm.expectRevert(MonitorTreasury.BudgetMismatch.selector);
        treasury.createTask{value: BUDGET - 1}(TASK_ID, BUDGET, DEADLINE_SECONDS);
        
        vm.stopPrank();
    }

    function test_CreateTask_RevertsIfZeroBudget() public {
        vm.startPrank(user);
        
        vm.expectRevert(MonitorTreasury.ZeroBudget.selector);
        treasury.createTask{value: 0}(TASK_ID, 0, DEADLINE_SECONDS);
        
        vm.stopPrank();
    }

    // =========================================================================
    // Spend Tests (Agent Authorization)
    // =========================================================================

    function test_Spend_AuthorizedAgentCanSpend() public {
        // Setup: User creates task, authorizes agent
        vm.startPrank(user);
        treasury.createTask{value: BUDGET}(TASK_ID, BUDGET, DEADLINE_SECONDS);
        treasury.authorizeAgent(TASK_ID, agent);
        vm.stopPrank();
        
        // Agent spends
        vm.startPrank(agent);
        treasury.spend(TASK_ID, serviceProvider, 0.1 ether, MEMO);
        vm.stopPrank();
        
        // Verify
        (, , uint256 spent, , ) = treasury.getTask(TASK_ID);
        assertEq(spent, 0.1 ether, "Spent should be updated");
    }

    function test_Spend_RevertsIfUnauthorized() public {
        // Setup
        vm.startPrank(user);
        treasury.createTask{value: BUDGET}(TASK_ID, BUDGET, DEADLINE_SECONDS);
        treasury.authorizeAgent(TASK_ID, agent);
        vm.stopPrank();
        
        // Unauthorized tries to spend
        vm.startPrank(unauthorized);
        vm.expectRevert(MonitorTreasury.Unauthorized.selector);
        treasury.spend(TASK_ID, serviceProvider, 0.1 ether, MEMO);
        vm.stopPrank();
    }

    function test_Spend_RevertsIfTaskInactive() public {
        // Setup
        vm.startPrank(user);
        treasury.createTask{value: BUDGET}(TASK_ID, BUDGET, DEADLINE_SECONDS);
        treasury.authorizeAgent(TASK_ID, agent);
        treasury.closeTask(TASK_ID); // Close task
        vm.stopPrank();
        
        // Agent tries to spend on closed task
        vm.startPrank(agent);
        vm.expectRevert(MonitorTreasury.TaskInactive.selector);
        treasury.spend(TASK_ID, serviceProvider, 0.1 ether, MEMO);
        vm.stopPrank();
    }

    function test_Spend_RevertsIfDeadlinePassed() public {
        // Setup
        vm.startPrank(user);
        treasury.createTask{value: BUDGET}(TASK_ID, BUDGET, DEADLINE_SECONDS);
        treasury.authorizeAgent(TASK_ID, agent);
        vm.stopPrank();
        
        // Warp past deadline
        vm.warp(block.timestamp + DEADLINE_SECONDS + 1);
        
        // Agent tries to spend after deadline
        vm.startPrank(agent);
        vm.expectRevert(MonitorTreasury.DeadlinePassed.selector);
        treasury.spend(TASK_ID, serviceProvider, 0.1 ether, MEMO);
        vm.stopPrank();
    }

    function test_Spend_RevertsIfExceedsBudget() public {
        // Setup
        vm.startPrank(user);
        treasury.createTask{value: BUDGET}(TASK_ID, BUDGET, DEADLINE_SECONDS);
        treasury.authorizeAgent(TASK_ID, agent);
        vm.stopPrank();
        
        // Agent tries to exceed budget
        vm.startPrank(agent);
        vm.expectRevert(MonitorTreasury.BudgetExceeded.selector);
        treasury.spend(TASK_ID, serviceProvider, BUDGET + 1, MEMO);
        vm.stopPrank();
    }

    function test_Spend_RevertsIfCumulativeSpendExceedsBudget() public {
        // Setup
        vm.startPrank(user);
        treasury.createTask{value: BUDGET}(TASK_ID, BUDGET, DEADLINE_SECONDS);
        treasury.authorizeAgent(TASK_ID, agent);
        vm.stopPrank();
        
        // First spend: 0.6 ETH
        vm.startPrank(agent);
        treasury.spend(TASK_ID, serviceProvider, 0.6 ether, MEMO);
        
        // Second spend: 0.5 ETH (would exceed 1 ETH budget)
        vm.expectRevert(MonitorTreasury.BudgetExceeded.selector);
        treasury.spend(TASK_ID, serviceProvider, 0.5 ether, MEMO);
        vm.stopPrank();
    }

    function test_Spend_TransfersToServiceProvider() public {
        // Setup
        vm.startPrank(user);
        treasury.createTask{value: BUDGET}(TASK_ID, BUDGET, DEADLINE_SECONDS);
        treasury.authorizeAgent(TASK_ID, agent);
        vm.stopPrank();
        
        uint256 providerBalanceBefore = serviceProvider.balance;
        
        // Agent spends
        vm.startPrank(agent);
        treasury.spend(TASK_ID, serviceProvider, 0.1 ether, MEMO);
        vm.stopPrank();
        
        uint256 providerBalanceAfter = serviceProvider.balance;
        assertEq(providerBalanceAfter - providerBalanceBefore, 0.1 ether, "Provider should receive payment");
    }

    function test_Spend_EmitsSpendEvent() public {
        // Setup
        vm.startPrank(user);
        treasury.createTask{value: BUDGET}(TASK_ID, BUDGET, DEADLINE_SECONDS);
        treasury.authorizeAgent(TASK_ID, agent);
        vm.stopPrank();
        
        // Expect event
        vm.startPrank(agent);
        vm.expectEmit(true, true, true, true);
        emit MonitorTreasury.Spend(TASK_ID, serviceProvider, 0.1 ether, MEMO);
        
        treasury.spend(TASK_ID, serviceProvider, 0.1 ether, MEMO);
        vm.stopPrank();
    }

    // =========================================================================
    // Record Spend Tests (Idempotency)
    // =========================================================================

    function test_RecordSpend_TracksSpendWithoutTransfer() public {
        // Setup
        vm.startPrank(user);
        treasury.createTask{value: BUDGET}(TASK_ID, BUDGET, DEADLINE_SECONDS);
        treasury.authorizeAgent(TASK_ID, agent);
        vm.stopPrank();
        
        uint256 providerBalanceBefore = serviceProvider.balance;
        
        // Record external spend (e.g., direct MPP)
        vm.startPrank(agent);
        treasury.recordSpend(TASK_ID, serviceProvider, 0.1 ether, MEMO);
        vm.stopPrank();
        
        // No transfer occurred
        assertEq(serviceProvider.balance, providerBalanceBefore, "Provider balance should not change");
        
        // But spent is tracked
        (, , uint256 spent, , ) = treasury.getTask(TASK_ID);
        assertEq(spent, 0.1 ether, "Spent should be tracked");
    }

    function test_RecordSpend_RevertsOnDuplicateIdempotency() public {
        // Setup
        vm.startPrank(user);
        treasury.createTask{value: BUDGET}(TASK_ID, BUDGET, DEADLINE_SECONDS);
        treasury.authorizeAgent(TASK_ID, agent);
        vm.stopPrank();
        
        bytes32 idempotencyKey = keccak256("unique-key-1");
        
        // First record
        vm.startPrank(agent);
        treasury.recordSpend(TASK_ID, serviceProvider, 0.1 ether, MEMO, idempotencyKey);
        
        // Duplicate should revert
        vm.expectRevert(MonitorTreasury.DuplicateIdempotency.selector);
        treasury.recordSpend(TASK_ID, serviceProvider, 0.2 ether, MEMO, idempotencyKey);
        vm.stopPrank();
    }

    function test_RecordSpend_SameIdempotencyDifferentAmountReverts() public {
        // Setup
        vm.startPrank(user);
        treasury.createTask{value: BUDGET}(TASK_ID, BUDGET, DEADLINE_SECONDS);
        treasury.authorizeAgent(TASK_ID, agent);
        vm.stopPrank();
        
        bytes32 idempotencyKey = keccak256("unique-key-1");
        
        // First record: 0.1 ETH
        vm.startPrank(agent);
        treasury.recordSpend(TASK_ID, serviceProvider, 0.1 ether, MEMO, idempotencyKey);
        
        // Same key, different amount: should revert, not add
        vm.expectRevert(MonitorTreasury.DuplicateIdempotency.selector);
        treasury.recordSpend(TASK_ID, serviceProvider, 0.2 ether, MEMO, idempotencyKey);
        vm.stopPrank();
        
        // Verify only first amount counted
        (, , uint256 spent, , ) = treasury.getTask(TASK_ID);
        assertEq(spent, 0.1 ether, "Only first amount should be counted");
    }

    // =========================================================================
    // Close Task Tests
    // =========================================================================

    function test_CloseTask_RefundsRemainingBudget() public {
        // Setup
        vm.startPrank(user);
        treasury.createTask{value: BUDGET}(TASK_ID, BUDGET, DEADLINE_SECONDS);
        treasury.authorizeAgent(TASK_ID, agent);
        
        // Spend 0.3 ETH
        vm.stopPrank();
        vm.startPrank(agent);
        treasury.spend(TASK_ID, serviceProvider, 0.3 ether, MEMO);
        vm.stopPrank();
        
        // Close and refund
        vm.startPrank(user);
        uint256 userBalanceBefore = user.balance;
        
        treasury.closeTask(TASK_ID);
        
        uint256 userBalanceAfter = user.balance;
        assertEq(userBalanceAfter - userBalanceBefore, 0.7 ether, "Should refund remaining 0.7 ETH");
        vm.stopPrank();
    }

    function test_CloseTask_MarksTaskInactive() public {
        // Setup
        vm.startPrank(user);
        treasury.createTask{value: BUDGET}(TASK_ID, BUDGET, DEADLINE_SECONDS);
        
        treasury.closeTask(TASK_ID);
        
        (, , , , bool active) = treasury.getTask(TASK_ID);
        assertFalse(active, "Task should be inactive");
        vm.stopPrank();
    }

    function test_CloseTask_RevertsIfNotOwner() public {
        // Setup
        vm.startPrank(user);
        treasury.createTask{value: BUDGET}(TASK_ID, BUDGET, DEADLINE_SECONDS);
        vm.stopPrank();
        
        // Unauthorized tries to close
        vm.startPrank(unauthorized);
        vm.expectRevert(MonitorTreasury.NotOwner.selector);
        treasury.closeTask(TASK_ID);
        vm.stopPrank();
    }

    function test_CloseTask_EmitsRefundEvent() public {
        // Setup
        vm.startPrank(user);
        treasury.createTask{value: BUDGET}(TASK_ID, BUDGET, DEADLINE_SECONDS);
        
        vm.expectEmit(true, true, true, true);
        emit MonitorTreasury.Close(TASK_ID, user, BUDGET);
        
        treasury.closeTask(TASK_ID);
        vm.stopPrank();
    }

    // =========================================================================
    // Authorization Tests
    // =========================================================================

    function test_AuthorizeAgent_AddsAuthorizedAgent() public {
        vm.startPrank(user);
        treasury.createTask{value: BUDGET}(TASK_ID, BUDGET, DEADLINE_SECONDS);
        
        treasury.authorizeAgent(TASK_ID, agent);
        
        assertTrue(treasury.isAuthorizedAgent(TASK_ID, agent), "Agent should be authorized");
        vm.stopPrank();
    }

    function test_AuthorizeAgent_RevertsIfNotOwner() public {
        vm.startPrank(user);
        treasury.createTask{value: BUDGET}(TASK_ID, BUDGET, DEADLINE_SECONDS);
        vm.stopPrank();
        
        vm.startPrank(unauthorized);
        vm.expectRevert(MonitorTreasury.NotOwner.selector);
        treasury.authorizeAgent(TASK_ID, agent);
        vm.stopPrank();
    }

    function test_RevokeAgent_RemovesAuthorization() public {
        vm.startPrank(user);
        treasury.createTask{value: BUDGET}(TASK_ID, BUDGET, DEADLINE_SECONDS);
        treasury.authorizeAgent(TASK_ID, agent);
        
        treasury.revokeAgent(TASK_ID, agent);
        
        assertFalse(treasury.isAuthorizedAgent(TASK_ID, agent), "Agent should be revoked");
        vm.stopPrank();
    }

    // =========================================================================
    // View Functions
    // =========================================================================

    function test_GetRemainingBudget_ReturnsCorrectAmount() public {
        vm.startPrank(user);
        treasury.createTask{value: BUDGET}(TASK_ID, BUDGET, DEADLINE_SECONDS);
        treasury.authorizeAgent(TASK_ID, agent);
        vm.stopPrank();
        
        vm.startPrank(agent);
        treasury.spend(TASK_ID, serviceProvider, 0.3 ether, MEMO);
        vm.stopPrank();
        
        uint256 remaining = treasury.getRemainingBudget(TASK_ID);
        assertEq(remaining, 0.7 ether, "Remaining should be 0.7 ETH");
    }

    function test_GetSpent_ReturnsTotalSpent() public {
        vm.startPrank(user);
        treasury.createTask{value: BUDGET}(TASK_ID, BUDGET, DEADLINE_SECONDS);
        treasury.authorizeAgent(TASK_ID, agent);
        vm.stopPrank();
        
        vm.startPrank(agent);
        treasury.spend(TASK_ID, serviceProvider, 0.2 ether, MEMO);
        treasury.spend(TASK_ID, serviceProvider, 0.3 ether, MEMO);
        vm.stopPrank();
        
        uint256 spent = treasury.getSpent(TASK_ID);
        assertEq(spent, 0.5 ether, "Spent should be 0.5 ETH");
    }
}