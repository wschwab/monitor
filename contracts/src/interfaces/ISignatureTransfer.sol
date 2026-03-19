// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal Permit2 ISignatureTransfer interface used by MonitorTreasury.
/// Full spec: https://github.com/Uniswap/permit2
interface ISignatureTransfer {
    /// @notice The token and max-amount details included in a signed permit.
    struct TokenPermissions {
        address token;
        uint256 amount;
    }

    /// @notice A signed permit authorising a single transfer.
    struct PermitTransferFrom {
        TokenPermissions permitted;
        uint256 nonce;      // unique value per signature to prevent replays
        uint256 deadline;   // unix timestamp after which the permit is invalid
    }

    /// @notice The actual transfer details (who receives how much).
    struct SignatureTransferDetails {
        address to;
        uint256 requestedAmount; // must be <= permit.permitted.amount
    }

    /// @notice Execute a token transfer using a signed permit.
    /// @dev Reverts if signature is invalid, expired, already used, or amount exceeds permitted.
    function permitTransferFrom(
        PermitTransferFrom memory permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes calldata signature
    ) external;
}
