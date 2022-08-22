// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.16;

import "@openzeppelin/contracts/governance/TimelockController.sol";
import "./HATVaultsRegistry.sol";

contract HATTimelockController is TimelockController {

    constructor(
        uint256 _minDelay,
        address[] memory _proposers,
        address[] memory _executors
    // solhint-disable-next-line no-empty-blocks
    ) TimelockController(_minDelay, _proposers, _executors) {}
    
    // Whitelisted functions

    function approveClaim(HATVault _vault, bytes32 _claimId, uint256 _bountyPercentage) external onlyRole(PROPOSER_ROLE) {
        _vault.approveClaim(_claimId, _bountyPercentage);
    }

    function challengeClaim(HATVault _vault, bytes32 _claimId) external onlyRole(PROPOSER_ROLE) {
        _vault.challengeClaim(_claimId);
    }

    function dismissClaim(HATVault _vault, bytes32 _claimId) external onlyRole(PROPOSER_ROLE) {
        _vault.dismissClaim(_claimId);
    }

    function setDepositPause(HATVault _vault, bool _depositPause) external onlyRole(PROPOSER_ROLE) {
        _vault.setDepositPause(_depositPause);
    }

    function setVaultVisibility(HATVault _vault, bool _visible) external onlyRole(PROPOSER_ROLE) {
        _vault.registry().setVaultVisibility(address(_vault), _visible);
    }

    function setVaultDescription(HATVault _vault, string memory _descriptionHash) external onlyRole(PROPOSER_ROLE) {
        _vault.registry().setVaultDescription(address(_vault), _descriptionHash);
    }

    function setAllocPoint(HATVault _vault, uint256 _allocPoint)
    external onlyRole(PROPOSER_ROLE) {
        _vault.rewardController().setAllocPoint(address(_vault), _allocPoint);
    }

    function swapBurnSend(
        HATVaultsRegistry _registry,
        address _asset,
        address[] calldata _beneficiaries,
        uint256 _amountOutMinimum,
        address _routingContract,
        bytes calldata _routingPayload
    )
    external
    onlyRole(PROPOSER_ROLE) {
        _registry.swapBurnSend(
            _asset,
            _beneficiaries,
            _amountOutMinimum,
            _routingContract,
            _routingPayload
        );
    }
}
