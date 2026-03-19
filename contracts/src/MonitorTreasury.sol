// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MonitorTreasury
 * @dev On-chain treasury for managing task budgets with spend tracking.
 *
 * Features:
 * - Task creation with budget and deadline
 * - Authorized agent spend with budget/deadline enforcement
 * - Record spend for off-chain payments (idempotency)
 * - Close task and refund remaining budget
 */
contract MonitorTreasury {
    // =========================================================================
    // Errors
    // =========================================================================

    error TaskExists();
    error TaskNotFound();
    error BudgetMismatch();
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
        bool active;
    }

    // =========================================================================
    // State Variables
    // =========================================================================

    /// @notice Task ID => Task details
    mapping(bytes32 => Task) public tasks;

    /// @notice Task ID => Agent => Is authorized
    mapping(bytes32 => mapping(address => bool)) public authorizedAgents;

    /// @notice Task ID => Idempotency Key => Is used
    mapping(bytes32 => mapping(bytes32 => bool)) public usedIdempotencyKeys;

    /// @notice Contract owner
    address public immutable owner;

    // =========================================================================
    // Constructor
    // =========================================================================

    constructor() {
        owner = msg.sender;
    }

    // =========================================================================
    // Modifiers
    // =========================================================================

    modifier onlyTaskOwner(bytes32 taskId) {
        if (tasks[taskId].owner != msg.sender) {
            revert NotOwner();
        }
        _;
    }

    modifier taskExists(bytes32 taskId) {
        if (tasks[taskId].owner == address(0)) {
            revert TaskNotFound();
        }
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
    // External Functions
    // =========================================================================

    /**
     * @notice Create a new task with budget and deadline.
     * @param taskId Unique identifier for the task
     * @param budget Total budget in wei
     * @param deadlineOffset Seconds from now until deadline
     */
    function createTask(
        bytes32 taskId,
        uint256 budget,
        uint256 deadlineOffset
    ) external payable {
        // Validate input
        if (budget == 0) {
            revert ZeroBudget();
        }
        if (msg.value != budget) {
            revert BudgetMismatch();
        }
        if (tasks[taskId].owner != address(0)) {
            revert TaskExists();
        }

        // Create task
        tasks[taskId] = Task({
            owner: msg.sender,
            budget: budget,
            spent: 0,
            deadline: block.timestamp + deadlineOffset,
            active: true
        });

        emit TaskCreated(taskId, msg.sender, budget, block.timestamp + deadlineOffset);
    }

    /**
     * @notice Authorize an agent to spend on behalf of a task.
     * @param taskId Task identifier
     * @param agent Address to authorize
     */
    function authorizeAgent(
        bytes32 taskId,
        address agent
    ) external onlyTaskOwner(taskId) taskExists(taskId) {
        authorizedAgents[taskId][agent] = true;
        emit AgentAuthorized(taskId, agent);
    }

    /**
     * @notice Revoke an agent's authorization.
     * @param taskId Task identifier
     * @param agent Address to revoke
     */
    function revokeAgent(
        bytes32 taskId,
        address agent
    ) external onlyTaskOwner(taskId) taskExists(taskId) {
        authorizedAgents[taskId][agent] = false;
        emit AgentRevoked(taskId, agent);
    }

    /**
     * @notice Spend from task budget, transferring to recipient.
     * @param taskId Task identifier
     * @param recipient Address to receive funds
     * @param amount Amount to spend in wei
     * @param memo 32-byte memo for tracking
     */
    function spend(
        bytes32 taskId,
        address recipient,
        uint256 amount,
        bytes32 memo
    ) external onlyAuthorized(taskId) taskExists(taskId) {
        Task storage task = tasks[taskId];

        // Validate task state
        _validateTaskActive(task);
        _validateDeadline(task);
        _validateBudget(task, amount);

        // Update state
        task.spent += amount;

        // Transfer funds
        (bool success, ) = recipient.call{value: amount}("");
        if (!success) {
            revert TransferFailed();
        }

        emit Spend(taskId, recipient, amount, memo);
    }

    /**
     * @notice Record a spend without transferring (for off-chain payments).
     * @param taskId Task identifier
     * @param recipient Address that would receive funds (for tracking)
     * @param amount Amount spent in wei
     * @param memo 32-byte memo for tracking
     */
    function recordSpend(
        bytes32 taskId,
        address recipient,
        uint256 amount,
        bytes32 memo
    ) external onlyAuthorized(taskId) taskExists(taskId) {
        Task storage task = tasks[taskId];

        // Validate task state
        _validateTaskActive(task);
        _validateDeadline(task);
        _validateBudget(task, amount);

        // Update state only (no transfer)
        task.spent += amount;

        emit RecordSpend(taskId, recipient, amount, memo, bytes32(0));
    }

    /**
     * @notice Record a spend with idempotency key (for direct MPP).
     * @param taskId Task identifier
     * @param recipient Address that would receive funds (for tracking)
     * @param amount Amount spent in wei
     * @param memo 32-byte memo for tracking
     * @param idempotencyKey Unique key to prevent duplicates
     */
    function recordSpend(
        bytes32 taskId,
        address recipient,
        uint256 amount,
        bytes32 memo,
        bytes32 idempotencyKey
    ) external onlyAuthorized(taskId) taskExists(taskId) {
        Task storage task = tasks[taskId];

        // Check idempotency
        if (usedIdempotencyKeys[taskId][idempotencyKey]) {
            revert DuplicateIdempotency();
        }

        // Validate task state
        _validateTaskActive(task);
        _validateDeadline(task);
        _validateBudget(task, amount);

        // Mark idempotency key as used
        usedIdempotencyKeys[taskId][idempotencyKey] = true;

        // Update state only (no transfer)
        task.spent += amount;

        emit RecordSpend(taskId, recipient, amount, memo, idempotencyKey);
    }

    /**
     * @notice Close task and refund remaining budget.
     * @param taskId Task identifier
     */
    function closeTask(bytes32 taskId) external onlyTaskOwner(taskId) taskExists(taskId) {
        Task storage task = tasks[taskId];

        uint256 refundAmount = task.budget - task.spent;

        // Mark inactive
        task.active = false;

        // Refund remaining budget
        if (refundAmount > 0) {
            (bool success, ) = task.owner.call{value: refundAmount}("");
            if (!success) {
                revert TransferFailed();
            }
        }

        emit Close(taskId, task.owner, refundAmount);
    }

    // =========================================================================
    // View Functions
    // =========================================================================

    /**
     * @notice Get task details.
     */
    function getTask(bytes32 taskId) external view returns (
        address taskOwner,
        uint256 budget,
        uint256 spent,
        uint256 deadline,
        bool active
    ) {
        Task storage task = tasks[taskId];
        return (task.owner, task.budget, task.spent, task.deadline, task.active);
    }

    /**
     * @notice Get remaining budget for a task.
     */
    function getRemainingBudget(bytes32 taskId) external view returns (uint256) {
        Task storage task = tasks[taskId];
        return task.budget - task.spent;
    }

    /**
     * @notice Get total spent for a task.
     */
    function getSpent(bytes32 taskId) external view returns (uint256) {
        return tasks[taskId].spent;
    }

    /**
     * @notice Check if an agent is authorized for a task.
     */
    function isAuthorizedAgent(bytes32 taskId, address agent) external view returns (bool) {
        return authorizedAgents[taskId][agent];
    }

    // =========================================================================
    // Internal Functions
    // =========================================================================

    function _validateTaskActive(Task storage task) internal view {
        if (!task.active) {
            revert TaskInactive();
        }
    }

    function _validateDeadline(Task storage task) internal view {
        if (block.timestamp > task.deadline) {
            revert DeadlinePassed();
        }
    }

    function _validateBudget(Task storage task, uint256 amount) internal view {
        if (task.spent + amount > task.budget) {
            revert BudgetExceeded();
        }
    }

    // =========================================================================
    // Receive Function
    // =========================================================================

    receive() external payable {
        // Accept direct transfers (for refunds, etc.)
    }
}