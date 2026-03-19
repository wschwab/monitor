// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../src/interfaces/ISignatureTransfer.sol";
import "../../src/interfaces/IERC20.sol";

/// @dev Test-only Permit2 stub: skips signature verification and just executes
///      the transferFrom. This lets unit tests exercise MonitorTreasury logic
///      without needing real secp256k1 signatures.
///
///      In production, use the canonical Permit2 at:
///      0x000000000022D473030F116dDEE9F6B43aC78BA3
contract MockPermit2 {
    function permitTransferFrom(
        ISignatureTransfer.PermitTransferFrom memory permit,
        ISignatureTransfer.SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes calldata /* signature — skipped in tests */
    ) external {
        require(
            transferDetails.requestedAmount <= permit.permitted.amount,
            "MockPermit2: amount exceeds permit"
        );
        require(block.timestamp <= permit.deadline, "MockPermit2: permit expired");

        bool ok = IERC20(permit.permitted.token).transferFrom(
            owner,
            transferDetails.to,
            transferDetails.requestedAmount
        );
        require(ok, "MockPermit2: transferFrom failed");
    }
}
