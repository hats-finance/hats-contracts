// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.14;

import "@openzeppelin/contracts/governance/TimelockController.sol";
import "./HATVaultsRegistry.sol";

contract HATTimelockController is TimelockController {
    HATVaultsRegistry public immutable hatVaultsRegistry;

    constructor(
        HATVaultsRegistry _hatVaultsRegistry,
        uint256 _minDelay,
        address[] memory _proposers,
        address[] memory _executors
    // solhint-disable-next-line func-visibility
    ) TimelockController(_minDelay, _proposers, _executors) {
        require(address(_hatVaultsRegistry) != address(0), "HATTimelockController: HATVaults address must not be 0");
        hatVaultsRegistry = _hatVaultsRegistry;
    }
    
    // Whitelisted functions

    function approveClaim(HATVault _vault, uint256 _claimId, uint256 _bountyPercentage) external onlyRole(PROPOSER_ROLE) {
        _vault.approveClaim(_claimId, _bountyPercentage);
    }

    function challengeClaim(HATVault _vault, uint256 _claimId) external onlyRole(PROPOSER_ROLE) {
        _vault.challengeClaim(_claimId);
    }

    function dismissClaim(HATVault _vault, uint256 _claimId) external onlyRole(PROPOSER_ROLE) {
        _vault.dismissClaim(_claimId);
    }

    function createVault(IERC20 _lpToken,
                    address _committee,
                    IRewardController _rewardController,
                    uint256 _maxBounty,
                    HATVault.BountySplit memory _bountySplit,
                    string memory _descriptionHash,
                    uint256[2] memory _bountyVestingParams,
                    bool _isPaused)
    external
    onlyRole(PROPOSER_ROLE) returns(address vault) {
        vault = hatVaultsRegistry.createVault(
            _lpToken,
            _committee,
            _rewardController,
            _maxBounty,
            _bountySplit,
            _descriptionHash,
            _bountyVestingParams,
            _isPaused
        );
    }

    function setPool(HATVault _vault, 
                    bool _registered,
                    bool _depositPause,
                    string memory _descriptionHash)
    external onlyRole(PROPOSER_ROLE) {
        _vault.setPool(
            _registered,
            _depositPause,
            _descriptionHash
        );
    }

    function setAllocPoint(HATVault _vault, uint256 _allocPoint)
    external onlyRole(PROPOSER_ROLE) {
        _vault.rewardController().setAllocPoint(address(_vault), _allocPoint);
    }

    function setCommittee(HATVault _vault, address _committee) external onlyRole(PROPOSER_ROLE) {
        _vault.setCommittee(_committee);
    }

    function swapBurnSend(HATVault _vault,
                        address _beneficiary,
                        uint256 _amountOutMinimum,
                        address _routingContract,
                        bytes calldata _routingPayload)
    external
    onlyRole(PROPOSER_ROLE) {
        _vault.swapBurnSend(
            _beneficiary,
            _amountOutMinimum,
            _routingContract,
            _routingPayload
        );
    }
}
