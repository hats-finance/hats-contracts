// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "../interfaces/IHATArbitrator.sol";
import "../HATKlerosConnector.sol";
import "../interfaces/IHATClaimsManager.sol";

contract BadKlerosConnectorEthReceiver {
    bool public shouldFail = true;

    function challengeResolution(
        IHATArbitrator _arbitrator,
        IHATClaimsManager _vault,
        bytes32 _claimId,
        string calldata _evidence
    ) external payable {
        _arbitrator.challengeResolution{value: msg.value}(_vault, _claimId, _evidence);
    }

    function fundAppeal(
        HATKlerosConnector _connector,
        uint256 _localDisputeId,
        uint256 _side
    ) external payable returns (bool) {
        return _connector.fundAppeal{value: msg.value}(_localDisputeId, _side);
    }
    
    function setShouldFail(bool _shouldFail) external {
        shouldFail = _shouldFail;
    }

    receive() external payable {
        if (shouldFail) {
            revert("cannot accept transfer");
        }
    }
   
}
