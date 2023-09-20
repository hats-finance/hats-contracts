// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "../HATKlerosConnector.sol";
//solhint-disable func-visibility 
//solhint-disable no-empty-blocks

contract HATKlerosConnectorMock is HATKlerosConnector {
    constructor (
        IArbitrator _klerosArbitrator,
        bytes memory _arbitratorExtraData,
        IHATArbitrator _hatArbitrator,
        string memory _metaEvidence,
        uint256 _winnerMultiplier,
        uint256 _loserMultiplier
    ) HATKlerosConnector(_klerosArbitrator,_arbitratorExtraData, _hatArbitrator, _metaEvidence, _winnerMultiplier, _loserMultiplier) {}

    function executeResolution(IHATArbitrator _arbitrator, IHATClaimsManager _vault, bytes32 _claimId) external {
        _arbitrator.executeResolution(_vault, _claimId);
    }

    function dismissResolution(IHATArbitrator _arbitrator, IHATClaimsManager _vault, bytes32 _claimId) external {
        _arbitrator.dismissResolution(_vault, _claimId);
    }
}
