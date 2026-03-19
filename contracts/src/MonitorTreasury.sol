// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "./interfaces/IERC20.sol";
import {ISignatureTransfer} from "./interfaces/ISignatureTransfer.sol";

/**
 * @title MonitorTreasury
 * @dev On-chain treasury for managing task budgets denominated in a single
 *      ERC-20 token (e.g. USDC on Tempo).
 *
 * Budget custody uses Permit2 for single-step UX: the caller signs a
 * PermitTransferFrom off-chain; createTask() pulls the tokens atomically
 * with no prior approve() call required.
 *
 * Features:
 * - Task creation with USDC budget via Permit2 (single-step, no approve)
 * - Authorized agent spend with budget/deadline enforcement
 * - Record spend for off-chain payments (idempotency via key)
 * - Close task and refund remaining budget to owner
 *
 * Deployed on Tempo mainnet (chain 4217):
 *   0x48AF06f2f573977ef8E8AD4ab14008729aBAF1E8  ← original (ETH model)
 * This version replaces that with USDC + Permit2.
 *
 * Permit2 canonical address (Tempo + all EVM chains):
 *   0x000000000022D473030F116dDEE9F6B43aC78BA3
 */
contract MonitorTreasury {
    // =========================================================================
    // Errors
    // =========================================================================

    error TaskExists();
    error TaskNotFound();
    error InvalidToken();       // permit token != treasury token
    error ZeroBudget();
    error Unauthorized();
    error TaskInactive();
    error DeadlinePassed();
    error BudgetExceeded();
    error NotOwner();
    error DuplicateIdempotency();
    error TransferFailed();

    // =========================================================================
    // Events
    // =========================================================================

    event TaskCreated(
        bytes32 indexed taskId,
        address indexed owner,
        uint256 budget,
        uint256 deadline
    );

    event Spend(
        bytes32 indexed taskId,
        address indexed recipient,
        uint256 amount,
        bytes32 memo
    );

    event RecordSpend(
        bytes32 indexed taskId,
        address indexed recipient,
        uint256 amount,
        bytes32 memo,
        bytes32 idempotencyKey
    );

    event Close(
        bytes32 indexed taskId,
        address indexed owner,
        uint256 refundAmount
    );

    event AgentAuthorized(bytes32 indexed taskId, address indexed agent);
    event AgentRevoked(bytes32 indexed taskId, address indexed agent);

    // =========================================================================
    // Structs
    // =========================================================================

    struct Task {
        address owner;
        uint256 budget;
        uint256 spent;
        uint256 deadline;
        bool    active;
    }

    // =========================================================================
    // Immutables
    // =========================================================================

    /// @notice The ERC-20 token used for all task budgets (e.g. USDC).
    IERC20 public immutable TOKEN;

    /// @notice The Permit2 contract used for single-step budget deposits.
    ISignatureTransfer public immutable PERMIT2;

    /// @notice Contract owner (deployer).
    address public immutable OWNER;

    // =========================================================================
    // State
    // =========================================================================

    /// @notice Task ID => Task details
    mapping(bytes32 => Task) public tasks;

    /// @notice Task ID => Agent => Is authorized
    mapping(bytes32 => mapping(address => bool)) public authorizedAgents;

    /// @notice Task ID => Idempotency Key => Is used
    mapping(bytes32 => mapping(bytes32 => bool)) public usedIdempotencyKeys;

    // =========================================================================
    // Constructor
    // =========================================================================

    /// @param token_   ERC-20 token address (e.g. USDC on Tempo)
    /// @param permit2_ Permit2 contract address
    constructor(address token_, address permit2_) {
        TOKEN   = IERC20(token_);
        PERMIT2 = ISignatureTransfer(permit2_);
        OWNER   = msg.sender;
    }

    // =========================================================================
    // Modifiers
    // =========================================================================

    modifier onlyTaskOwner(bytes32 taskId) {
        if (tasks[taskId].owner != msg.sender) revert NotOwner();
        _;
    }

    modifier taskExists(bytes32 taskId) {
        if (tasks[taskId].owner == address(0)) revert TaskNotFound();
        _;
    }

    modifier onlyAuthorized(bytes32 taskId) {
        Task storage task = tasks[taskId];
        if (msg.sender != task.owner && !authorizedAgents[taskId][msg.sender]) {
            revert Unauthorized();
        }
        _;
    }

    // =========================================================================
    // External — task lifecycle
    // =========================================================================

    /**
     * @notice Create a new task, pulling budget from caller via Permit2.
     *
     * The caller must have signed a Permit2 PermitTransferFrom off-chain.
     * No prior ERC-20 approve() to this contract is needed.
     *
     * @param taskId          Unique task identifier
     * @param budget          USDC amount to lock (must match permit.permitted.amount)
     * @param deadlineOffset  Seconds from now until task expires
     * @param permit          Signed Permit2 authorization (token, amount, nonce, deadline)
     * @param signature       Caller's EIP-712 signature over the permit
     */
    function createTask(
        bytes32 taskId,
        uint256 budget,
        uint256 deadlineOffset,
        ISignatureTransfer.PermitTransferFrom calldata permit,
        bytes calldata signature
    ) external {
        if (budget == 0) revert ZeroBudget();
        if (tasks[taskId].owner != address(0)) revert TaskExists();
        if (permit.permitted.token != address(TOKEN)) revert InvalidToken();

        // Single-step: pull USDC from caller atomically via Permit2.
        // Permit2 validates the signature, nonce, deadline, and amount.
        PERMIT2.permitTransferFrom(
            permit,
            ISignatureTransfer.SignatureTransferDetails({
                to:              address(this),
                requestedAmount: budget
            }),
            msg.sender,
            signature
        );

        uint256 deadline = block.timestamp + deadlineOffset;
        tasks[taskId] = Task({
            owner:    msg.sender,
            budget:   budget,
            spent:    0,
            deadline: deadline,
            active:   true
        });

        emit TaskCreated(taskId, msg.sender, budget, deadline);
    }

    /**
     * @notice Authorize an agent to spend on behalf of a task.
     */
    function authorizeAgent(bytes32 taskId, address agent)
        external
        onlyTaskOwner(taskId)
        taskExists(taskId)
    {
        authorizedAgents[taskId][agent] = true;
        emit AgentAuthorized(taskId, agent);
    }

    /**
     * @notice Revoke an agent's authorization.
     */
    function revokeAgent(bytes32 taskId, address agent)
        external
        onlyTaskOwner(taskId)
        taskExists(taskId)
    {
        authorizedAgents[taskId][agent] = false;
        emit AgentRevoked(taskId, agent);
    }

    /**
     * @notice Spend from task budget, transferring USDC to recipient.
     */
    function spend(
        bytes32 taskId,
        address recipient,
        uint256 amount,
        bytes32 memo
    ) external onlyAuthorized(taskId) taskExists(taskId) {
        Task storage task = tasks[taskId];
        _validateTaskActive(task);
        _validateDeadline(task);
        _validateBudget(task, amount);

        task.spent += amount;

        if (!TOKEN.transfer(recipient, amount)) revert TransferFailed();

        emit Spend(taskId, recipient, amount, memo);
    }

    /**
     * @notice Record a spend without transferring (for off-chain / MPP payments).
     */
    function recordSpend(
        bytes32 taskId,
        address recipient,
        uint256 amount,
        bytes32 memo
    ) external onlyAuthorized(taskId) taskExists(taskId) {
        Task storage task = tasks[taskId];
        _validateTaskActive(task);
        _validateDeadline(task);
        _validateBudget(task, amount);

        task.spent += amount;

        emit RecordSpend(taskId, recipient, amount, memo, bytes32(0));
    }

    /**
     * @notice Record a spend with idempotency key (prevents duplicate off-chain records).
     */
    function recordSpend(
        bytes32 taskId,
        address recipient,
        uint256 amount,
        bytes32 memo,
        bytes32 idempotencyKey
    ) external onlyAuthorized(taskId) taskExists(taskId) {
        if (usedIdempotencyKeys[taskId][idempotencyKey]) revert DuplicateIdempotency();

        Task storage task = tasks[taskId];
        _validateTaskActive(task);
        _validateDeadline(task);
        _validateBudget(task, amount);

        usedIdempotencyKeys[taskId][idempotencyKey] = true;
        task.spent += amount;

        emit RecordSpend(taskId, recipient, amount, memo, idempotencyKey);
    }

    /**
     * @notice Close task and refund unspent USDC to owner.
     */
    function closeTask(bytes32 taskId)
        external
        onlyTaskOwner(taskId)
        taskExists(taskId)
    {
        Task storage task = tasks[taskId];
        uint256 refund = task.budget - task.spent;

        task.active = false;

        if (refund > 0) {
            if (!TOKEN.transfer(task.owner, refund)) revert TransferFailed();
        }

        emit Close(taskId, task.owner, refund);
    }

    // =========================================================================
    // View functions
    // =========================================================================

    function getTask(bytes32 taskId) external view returns (
        address taskOwner,
        uint256 budget,
        uint256 spent,
        uint256 deadline,
        bool    active
    ) {
        Task storage t = tasks[taskId];
        return (t.owner, t.budget, t.spent, t.deadline, t.active);
    }

    function getRemainingBudget(bytes32 taskId) external view returns (uint256) {
        Task storage t = tasks[taskId];
        return t.budget - t.spent;
    }

    function getSpent(bytes32 taskId) external view returns (uint256) {
        return tasks[taskId].spent;
    }

    function isAuthorizedAgent(bytes32 taskId, address agent) external view returns (bool) {
        return authorizedAgents[taskId][agent];
    }

    // =========================================================================
    // Internal
    // =========================================================================

    function _validateTaskActive(Task storage task) internal view {
        if (!task.active) revert TaskInactive();
    }

    function _validateDeadline(Task storage task) internal view {
        if (block.timestamp > task.deadline) revert DeadlinePassed();
    }

    function _validateBudget(Task storage task, uint256 amount) internal view {
        if (task.spent + amount > task.budget) revert BudgetExceeded();
    }
}
