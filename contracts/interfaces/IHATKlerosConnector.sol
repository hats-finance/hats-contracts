// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "./IHATClaimsManager.sol";

interface IHATKlerosConnector {

    enum Decision {
        None, // Court wasn't able to make a decisive ruling. In this case the resolution is dismissed. Both sides will get their appeal deposits back in this case.
        ExecuteResolution, // Execute expert's committee resolution.
        DismissResolution // Dismiss the resolution.
    }

    function notifyArbitrator(bytes32 _claimId, string calldata _evidence, IHATClaimsManager _vault, address _disputer) external payable;
}
