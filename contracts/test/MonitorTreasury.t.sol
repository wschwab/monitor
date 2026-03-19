// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MonitorTreasury.sol";
import "../src/interfaces/ISignatureTransfer.sol";
import "./mocks/MockERC20.sol";
import "./mocks/MockPermit2.sol";

/**
 * @title MonitorTreasuryTest
 * @dev Comprehensive tests for MonitorTreasury (Permit2 / USDC variant).
 *
 * Budget is denominated in USDC (6 decimals). Permit2 replaces msg.value:
 * the user signs a PermitTransferFrom off-chain; the contract pulls USDC
 * atomically in createTask() with no prior approve() needed.
 */
contract MonitorTreasuryTest is Test {
    MonitorTreasury public treasury;
    MockERC20       public usdc;
    MockPermit2     public permit2;

    // Test accounts
    address public owner           = address(1);
    address public user            = address(2);
    address public agent           = address(3);
    address public unauthorized    = address(4);
    address public serviceProvider = address(5);

    // Test values — 1 USDC (6 decimals)
    uint256 public constant BUDGET           = 1_000_000;
    uint256 public constant DEADLINE_SECONDS = 1 hours;
    bytes32 public constant TASK_ID          = keccak256("test-task-1");
    bytes32 public constant MEMO             = keccak256("test-memo");

    // =========================================================================
    // Helpers
    // =========================================================================

    /// @dev Build a PermitTransferFrom for usdc with a 1-hour deadline.
    function _permit(uint256 amount) internal view
        returns (ISignatureTransfer.PermitTransferFrom memory)
    {
        return ISignatureTransfer.PermitTransferFrom({
            permitted: ISignatureTransfer.TokenPermissions({
                token:  address(usdc),
                amount: amount
            }),
            nonce:    0,
            deadline: block.timestamp + 1 hours
        });
    }

    // =========================================================================
    // Setup
    // =========================================================================

    function setUp() public {
        usdc    = new MockERC20("USD Coin", "USDC", 6);
        permit2 = new MockPermit2();

        vm.prank(owner);
        treasury = new MonitorTreasury(address(usdc), address(permit2));

        // Fund test accounts with USDC
        usdc.mint(user,  10_000_000); // 10 USDC
        usdc.mint(agent,  1_000_000); //  1 USDC

        // Users must approve Permit2 once (real world) or the treasury directly
        vm.prank(user);
        usdc.approve(address(permit2), type(uint256).max);
    }

    // =========================================================================
    // createTask
    // =========================================================================

    function test_CreateTask_PullsBudgetFromUser() public {
        uint256 before = usdc.balanceOf(user);

        vm.prank(user);
        treasury.createTask(TASK_ID, BUDGET, DEADLINE_SECONDS, _permit(BUDGET), "");

        assertEq(before - usdc.balanceOf(user),            BUDGET, "USDC pulled from user");
        assertEq(usdc.balanceOf(address(treasury)), BUDGET, "Treasury holds USDC");
    }

    function test_CreateTask_StoresTaskDetails() public {
        vm.prank(user);
        treasury.createTask(TASK_ID, BUDGET, DEADLINE_SECONDS, _permit(BUDGET), "");

        (address taskOwner, uint256 budget, uint256 spent, uint256 deadline, bool active) =
            treasury.getTask(TASK_ID);

        assertEq(taskOwner, user,                              "owner");
        assertEq(budget,    BUDGET,                            "budget");
        assertEq(spent,     0,                                 "spent");
        assertEq(deadline,  block.timestamp + DEADLINE_SECONDS,"deadline");
        assertTrue(active,                                     "active");
    }

    function test_CreateTask_EmitsTaskCreatedEvent() public {
        vm.prank(user);
        vm.expectEmit(true, true, false, false);
        emit MonitorTreasury.TaskCreated(TASK_ID, user, BUDGET, 0);
        treasury.createTask(TASK_ID, BUDGET, DEADLINE_SECONDS, _permit(BUDGET), "");
    }

    function test_CreateTask_RevertsIfTaskExists() public {
        vm.startPrank(user);
        treasury.createTask(TASK_ID, BUDGET, DEADLINE_SECONDS, _permit(BUDGET), "");

        vm.expectRevert(MonitorTreasury.TaskExists.selector);
        treasury.createTask(TASK_ID, BUDGET, DEADLINE_SECONDS, _permit(BUDGET), "");
        vm.stopPrank();
    }

    function test_CreateTask_RevertsIfZeroBudget() public {
        vm.prank(user);
        vm.expectRevert(MonitorTreasury.ZeroBudget.selector);
        treasury.createTask(TASK_ID, 0, DEADLINE_SECONDS, _permit(0), "");
    }

    function test_CreateTask_RevertsIfWrongToken() public {
        MockERC20 wrongToken = new MockERC20("Wrong", "WRONG", 18);
        wrongToken.mint(user, 10e18);
        vm.prank(user);
        wrongToken.approve(address(permit2), type(uint256).max);

        ISignatureTransfer.PermitTransferFrom memory badPermit =
            ISignatureTransfer.PermitTransferFrom({
                permitted: ISignatureTransfer.TokenPermissions({
                    token:  address(wrongToken),
                    amount: BUDGET
                }),
                nonce:    0,
                deadline: block.timestamp + 1 hours
            });

        vm.prank(user);
        vm.expectRevert(MonitorTreasury.InvalidToken.selector);
        treasury.createTask(TASK_ID, BUDGET, DEADLINE_SECONDS, badPermit, "");
    }

    // =========================================================================
    // spend
    // =========================================================================

    function _setupActiveTask() internal {
        vm.prank(user);
        treasury.createTask(TASK_ID, BUDGET, DEADLINE_SECONDS, _permit(BUDGET), "");
        vm.prank(user);
        treasury.authorizeAgent(TASK_ID, agent);
    }

    function test_Spend_AuthorizedAgentCanSpend() public {
        _setupActiveTask();

        vm.prank(agent);
        treasury.spend(TASK_ID, serviceProvider, 100_000, MEMO);

        (, , uint256 spent, , ) = treasury.getTask(TASK_ID);
        assertEq(spent, 100_000);
    }

    function test_Spend_TransfersUSDCToServiceProvider() public {
        _setupActiveTask();
        uint256 before = usdc.balanceOf(serviceProvider);

        vm.prank(agent);
        treasury.spend(TASK_ID, serviceProvider, 100_000, MEMO);

        assertEq(usdc.balanceOf(serviceProvider) - before, 100_000);
    }

    function test_Spend_TaskOwnerCanSpendWithoutAuthorization() public {
        vm.prank(user);
        treasury.createTask(TASK_ID, BUDGET, DEADLINE_SECONDS, _permit(BUDGET), "");

        vm.prank(user);
        treasury.spend(TASK_ID, serviceProvider, 100_000, MEMO);

        (, , uint256 spent, , ) = treasury.getTask(TASK_ID);
        assertEq(spent, 100_000);
    }

    function test_Spend_RevertsIfUnauthorized() public {
        _setupActiveTask();

        vm.prank(unauthorized);
        vm.expectRevert(MonitorTreasury.Unauthorized.selector);
        treasury.spend(TASK_ID, serviceProvider, 100_000, MEMO);
    }

    function test_Spend_RevertsIfTaskInactive() public {
        _setupActiveTask();
        vm.prank(user);
        treasury.closeTask(TASK_ID);

        vm.prank(agent);
        vm.expectRevert(MonitorTreasury.TaskInactive.selector);
        treasury.spend(TASK_ID, serviceProvider, 100_000, MEMO);
    }

    function test_Spend_RevertsIfDeadlinePassed() public {
        _setupActiveTask();
        vm.warp(block.timestamp + DEADLINE_SECONDS + 1);

        vm.prank(agent);
        vm.expectRevert(MonitorTreasury.DeadlinePassed.selector);
        treasury.spend(TASK_ID, serviceProvider, 100_000, MEMO);
    }

    function test_Spend_RevertsIfExceedsBudget() public {
        _setupActiveTask();

        vm.prank(agent);
        vm.expectRevert(MonitorTreasury.BudgetExceeded.selector);
        treasury.spend(TASK_ID, serviceProvider, BUDGET + 1, MEMO);
    }

    function test_Spend_RevertsIfCumulativeSpendExceedsBudget() public {
        _setupActiveTask();

        vm.startPrank(agent);
        treasury.spend(TASK_ID, serviceProvider, 600_000, MEMO);
        vm.expectRevert(MonitorTreasury.BudgetExceeded.selector);
        treasury.spend(TASK_ID, serviceProvider, 500_000, MEMO);
        vm.stopPrank();
    }

    function test_Spend_EmitsSpendEvent() public {
        _setupActiveTask();

        vm.prank(agent);
        vm.expectEmit(true, true, true, true);
        emit MonitorTreasury.Spend(TASK_ID, serviceProvider, 100_000, MEMO);
        treasury.spend(TASK_ID, serviceProvider, 100_000, MEMO);
    }

    // =========================================================================
    // recordSpend (no-transfer accounting)
    // =========================================================================

    function test_RecordSpend_TracksSpendWithoutTransfer() public {
        _setupActiveTask();
        uint256 before = usdc.balanceOf(serviceProvider);

        vm.prank(agent);
        treasury.recordSpend(TASK_ID, serviceProvider, 100_000, MEMO);

        assertEq(usdc.balanceOf(serviceProvider), before, "no transfer");
        (, , uint256 spent, , ) = treasury.getTask(TASK_ID);
        assertEq(spent, 100_000, "spent tracked");
    }

    function test_RecordSpend_RevertsOnDuplicateIdempotency() public {
        _setupActiveTask();
        bytes32 ikey = keccak256("key-1");

        vm.startPrank(agent);
        treasury.recordSpend(TASK_ID, serviceProvider, 100_000, MEMO, ikey);
        vm.expectRevert(MonitorTreasury.DuplicateIdempotency.selector);
        treasury.recordSpend(TASK_ID, serviceProvider, 200_000, MEMO, ikey);
        vm.stopPrank();
    }

    function test_RecordSpend_SameKeyDifferentAmountReverts() public {
        _setupActiveTask();
        bytes32 ikey = keccak256("key-1");

        vm.startPrank(agent);
        treasury.recordSpend(TASK_ID, serviceProvider, 100_000, MEMO, ikey);
        vm.expectRevert(MonitorTreasury.DuplicateIdempotency.selector);
        treasury.recordSpend(TASK_ID, serviceProvider, 200_000, MEMO, ikey);
        vm.stopPrank();

        (, , uint256 spent, , ) = treasury.getTask(TASK_ID);
        assertEq(spent, 100_000, "only first amount counted");
    }

    // =========================================================================
    // closeTask
    // =========================================================================

    function test_CloseTask_RefundsRemainingUSDC() public {
        _setupActiveTask();
        vm.prank(agent);
        treasury.spend(TASK_ID, serviceProvider, 300_000, MEMO);

        uint256 before = usdc.balanceOf(user);
        vm.prank(user);
        treasury.closeTask(TASK_ID);

        assertEq(usdc.balanceOf(user) - before, 700_000, "refund 0.7 USDC");
    }

    function test_CloseTask_MarksTaskInactive() public {
        vm.prank(user);
        treasury.createTask(TASK_ID, BUDGET, DEADLINE_SECONDS, _permit(BUDGET), "");
        vm.prank(user);
        treasury.closeTask(TASK_ID);

        (, , , , bool active) = treasury.getTask(TASK_ID);
        assertFalse(active);
    }

    function test_CloseTask_RevertsIfNotOwner() public {
        vm.prank(user);
        treasury.createTask(TASK_ID, BUDGET, DEADLINE_SECONDS, _permit(BUDGET), "");

        vm.prank(unauthorized);
        vm.expectRevert(MonitorTreasury.NotOwner.selector);
        treasury.closeTask(TASK_ID);
    }

    function test_CloseTask_EmitsCloseEvent() public {
        vm.prank(user);
        treasury.createTask(TASK_ID, BUDGET, DEADLINE_SECONDS, _permit(BUDGET), "");

        vm.prank(user);
        vm.expectEmit(true, true, true, true);
        emit MonitorTreasury.Close(TASK_ID, user, BUDGET);
        treasury.closeTask(TASK_ID);
    }

    // =========================================================================
    // authorizeAgent / revokeAgent
    // =========================================================================

    function test_AuthorizeAgent_AddsAuthorizedAgent() public {
        vm.prank(user);
        treasury.createTask(TASK_ID, BUDGET, DEADLINE_SECONDS, _permit(BUDGET), "");
        vm.prank(user);
        treasury.authorizeAgent(TASK_ID, agent);

        assertTrue(treasury.isAuthorizedAgent(TASK_ID, agent));
    }

    function test_AuthorizeAgent_RevertsIfNotOwner() public {
        vm.prank(user);
        treasury.createTask(TASK_ID, BUDGET, DEADLINE_SECONDS, _permit(BUDGET), "");

        vm.prank(unauthorized);
        vm.expectRevert(MonitorTreasury.NotOwner.selector);
        treasury.authorizeAgent(TASK_ID, agent);
    }

    function test_RevokeAgent_RemovesAuthorization() public {
        vm.prank(user);
        treasury.createTask(TASK_ID, BUDGET, DEADLINE_SECONDS, _permit(BUDGET), "");
        vm.prank(user);
        treasury.authorizeAgent(TASK_ID, agent);
        vm.prank(user);
        treasury.revokeAgent(TASK_ID, agent);

        assertFalse(treasury.isAuthorizedAgent(TASK_ID, agent));
    }

    // =========================================================================
    // View helpers
    // =========================================================================

    function test_GetRemainingBudget_ReturnsCorrectAmount() public {
        _setupActiveTask();

        vm.prank(agent);
        treasury.spend(TASK_ID, serviceProvider, 300_000, MEMO);

        assertEq(treasury.getRemainingBudget(TASK_ID), 700_000);
    }

    function test_GetSpent_ReturnsTotalSpent() public {
        _setupActiveTask();

        vm.startPrank(agent);
        treasury.spend(TASK_ID, serviceProvider, 200_000, MEMO);
        treasury.spend(TASK_ID, serviceProvider, 300_000, MEMO);
        vm.stopPrank();

        assertEq(treasury.getSpent(TASK_ID), 500_000);
    }
}
