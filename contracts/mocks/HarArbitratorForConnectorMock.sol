// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.16;

import "../interfaces/IHATKlerosConnector.sol";


/* solhint-disable not-rely-on-time */
contract HATArbitratorForConnector {

    struct Resolution {
        address beneficiary;
        uint16 bountyPercentage;
        uint256 resolvedAt;
    }

    IHATKlerosConnector public court;
    uint256 public resolutionChallengePeriod; // the amount of time that the expert committee's resolution can be challenged

    mapping(IHATClaimsManager => mapping(bytes32 => Resolution)) public resolutions; // resolutions of disputes by the expert committee
    mapping(IHATClaimsManager => mapping(bytes32 => uint256)) public resolutionChallengedAt;


    modifier onlyResolvedDispute(IHATClaimsManager _vault, bytes32 _claimId) {
        if (resolutions[_vault][_claimId].resolvedAt == 0) {
            revert("Unresolved");
        }
        _;
    }

    modifier onlyUnresolvedDispute(IHATClaimsManager _vault, bytes32 _claimId) {
        if (resolutions[_vault][_claimId].resolvedAt != 0) {
            revert("AlreadyResolved");
        }
        _;
    }

    constructor(uint256 _resolutionChallengePeriod) {
        resolutionChallengePeriod = _resolutionChallengePeriod;
    }

    function setCourt(IHATKlerosConnector _court) external {
        court = _court;
    }

    // Challenge committee's claim
    function dispute(
        IHATClaimsManager _vault,
        bytes32 _claimId
    ) external {
        IHATClaimsManager.Claim memory claim = _vault.getActiveClaim();
        if (claim.claimId != _claimId) {
            revert("ClaimIsNotCurrentlyActiveClaim");
        }

        if (claim.challengedAt == 0) {
            _vault.challengeClaim(_claimId);
        }
    }

    // Accept the dispute on behalf of expert's committee.
    function acceptDispute(
        IHATClaimsManager _vault,
        bytes32 _claimId,
        uint16 _bountyPercentage,
        address _beneficiary
    )
        external

        onlyUnresolvedDispute(_vault, _claimId)
    {
        resolutions[_vault][_claimId] = Resolution({
            bountyPercentage: _bountyPercentage,
            beneficiary: _beneficiary,
            resolvedAt: block.timestamp
        });
    }

    function challengeResolution(
        IHATClaimsManager _vault,
        bytes32 _claimId,
        string calldata _evidence
    )
        external payable
        onlyResolvedDispute(_vault, _claimId)
    {
        if (
            block.timestamp >=
            resolutions[_vault][_claimId].resolvedAt + resolutionChallengePeriod
        ) {
            revert("ChallengePeriodPassed");
        }

        resolutionChallengedAt[_vault][_claimId] = block.timestamp;
        court.notifyArbitrator{value: msg.value}(_claimId, _evidence, _vault, msg.sender);
    }  

    function executeResolution(
        IHATClaimsManager _vault,
        bytes32 _claimId
    )
        external
        onlyResolvedDispute(_vault, _claimId)
    {
        Resolution memory resolution = resolutions[_vault][_claimId];

        if (resolutionChallengedAt[_vault][_claimId] != 0) {
            if (msg.sender != address(court)) {
                revert("Only court can call");
            }
        } else {
            if (
                block.timestamp <
                resolution.resolvedAt + resolutionChallengePeriod
            ) {
                revert("ChallengePeriodDidNotPass");
            }
        }

        _vault.approveClaim(
            _claimId,
            resolution.bountyPercentage,
            resolution.beneficiary
        );
    }

    function dismissResolution(
        IHATClaimsManager _vault,
        bytes32 _claimId
    )
        external
        onlyResolvedDispute(_vault, _claimId)
    {
        if (resolutionChallengedAt[_vault][_claimId] == 0) {
            revert("CannotDismissUnchallengedResolution");
        }

        if (msg.sender != address(court)) {
            revert("CanOnlyBeCalledByCourt");
        }

        _vault.dismissClaim(_claimId);
    }  
}
