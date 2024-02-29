// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.16;

import "@openzeppelin/contracts/governance/TimelockController.sol";
import "./HATGovernanceArbitrator.sol";

contract HATTimelockController is TimelockController {

    constructor(
        uint256 _minDelay,
        address[] memory _proposers,
        address[] memory _executors
    // solhint-disable-next-line no-empty-blocks
    ) TimelockController(_minDelay, _proposers, _executors, address(0)) {}
    
    // The following functions are not subject to the timelock

    function approveClaim(HATGovernanceArbitrator _arbitrator, IHATClaimsManager _claimsManager, bytes32 _claimId) external onlyRole(PROPOSER_ROLE) {
        _arbitrator.approveClaim(_claimsManager, _claimId);
    }

    function dismissClaim(HATGovernanceArbitrator _arbitrator, IHATClaimsManager _claimsManager, bytes32 _claimId) external onlyRole(PROPOSER_ROLE) {
        _arbitrator.dismissClaim(_claimsManager, _claimId);
    }

    function setCommittee(IHATClaimsManager _claimsManager, address _committee) external onlyRole(PROPOSER_ROLE) {
        _claimsManager.setCommittee(_committee);
    }

    function setVaultDescription(IHATVault _vault, string memory _descriptionHash) external onlyRole(PROPOSER_ROLE) {
        _vault.setVaultDescription(_descriptionHash);
    }

    function setDepositPause(IHATVault _vault, bool _depositPause) external onlyRole(PROPOSER_ROLE) {
        _vault.setDepositPause(_depositPause);
    }

    function setVaultVisibility(IHATVault _vault, bool _visible) external onlyRole(PROPOSER_ROLE) {
        _vault.registry().setVaultVisibility(address(_vault), _visible);
    }

    function setAllocPoint(IHATVault _vault, IRewardController _rewardController, uint256 _allocPoint)
    external onlyRole(PROPOSER_ROLE) {
        _rewardController.setAllocPoint(address(_vault), _allocPoint);
    }

    function setEmergencyPaused(IHATVaultsRegistry _registry, bool _isEmergencyPaused) external onlyRole(PROPOSER_ROLE) {
        _registry.setEmergencyPaused(_isEmergencyPaused);
    }
}
