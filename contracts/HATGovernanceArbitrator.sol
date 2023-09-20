// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.16;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IHATClaimsManager.sol";

contract HATGovernanceArbitrator is Ownable {

    function approveClaim(IHATClaimsManager _vault, bytes32 _claimId) external onlyOwner {
        _vault.challengeClaim(_claimId);
        _vault.approveClaim(_claimId, 0, address(0));
    }

    function dismissClaim(IHATClaimsManager _vault, bytes32 _claimId) external onlyOwner {
        _vault.challengeClaim(_claimId);
        _vault.dismissClaim(_claimId);
    }

}
