// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.16;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IHATClaimsManager.sol";

contract ExpertCommitteeArbitrator is Ownable {
    address public expertCommittee;

    error OnlyExpertCommittee();

    modifier onlyExpertCommittee() {
        if (msg.sender != expertCommittee) {
            revert OnlyExpertCommittee();
        }
        _;
    }

    constructor(address _expertCommittee) {
        expertCommittee = _expertCommittee;
    }

    function setExpertCommittee(address _expertCommittee) external onlyOwner {
        expertCommittee = _expertCommittee;
    }

    function challengeClaim(IHATClaimsManager _vault, bytes32 _claimId, uint16 _bountyPercentage, address _beneficiary) external onlyExpertCommittee {
        _vault.challengeClaim(_claimId, _bountyPercentage, _beneficiary);
    }

    function approveClaim(IHATClaimsManager _vault, bytes32 _claimId) external onlyOwner {
        _vault.approveClaim(_claimId, 0, address(0));
    }

    function dismissClaim(IHATClaimsManager _vault, bytes32 _claimId) external onlyOwner {
        _vault.dismissClaim(_claimId);
    }
}
