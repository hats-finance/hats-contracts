// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.14;

import "@openzeppelin/contracts/governance/TimelockController.sol";
import "./HATVaults.sol";

contract HATTimelockController is TimelockController {
    HATVaults public immutable hatVaults;

    constructor(
        HATVaults _hatVaults,
        uint256 _minDelay,
        address[] memory _proposers,
        address[] memory _executors
    // solhint-disable-next-line func-visibility
    ) TimelockController(_minDelay, _proposers, _executors) {
        require(address(_hatVaults) != address(0), "HATTimelockController: HATVaults address must not be 0");
        hatVaults = _hatVaults;
    }
    
    // Whitelisted functions

    function approveClaim(uint256 _claimId, uint256 _bountyPercentage) external onlyRole(PROPOSER_ROLE) {
        hatVaults.approveClaim(_claimId, _bountyPercentage);
    }

    function challengeClaim(uint256 _claimId) external onlyRole(PROPOSER_ROLE) {
        hatVaults.challengeClaim(_claimId);
    }

    function dismissClaim(uint256 _claimId) external onlyRole(PROPOSER_ROLE) {
        hatVaults.dismissClaim(_claimId);
    }

    function addPool(address _lpToken,
                    address _committee,
                    IRewardController _rewardController,
                    uint256 _maxBounty,
                    HATVaults.BountySplit memory _bountySplit,
                    string memory _descriptionHash,
                    uint256[2] memory _bountyVestingParams,
                    bool _isPaused,
                    bool _isInitialized)
    external
    onlyRole(PROPOSER_ROLE) {
        hatVaults.addPool(
            _lpToken,
            _committee,
            _rewardController,
            _maxBounty,
            _bountySplit,
            _descriptionHash,
            _bountyVestingParams,
            _isPaused,
            _isInitialized
        );
    }

    function setPool(uint256 _pid,
                    bool _registered,
                    bool _depositPause,
                    string memory _descriptionHash)
    external onlyRole(PROPOSER_ROLE) {
        hatVaults.setPool(
            _pid,
            _registered,
            _depositPause,
            _descriptionHash
        );
    }

    function setAllocPoint(uint256 _pid, uint256 _allocPoint)
    external onlyRole(PROPOSER_ROLE) {
        ( , , , , , IRewardController rewardController) = hatVaults.poolInfos(_pid);
        rewardController.setAllocPoint(_pid, _allocPoint);
    }

    function setCommittee(uint256 _pid, address _committee) external onlyRole(PROPOSER_ROLE) {
        hatVaults.setCommittee(_pid, _committee);
    }

    function swapBurnSend(uint256 _pid,
                        address _beneficiary,
                        uint256 _amountOutMinimum,
                        address _routingContract,
                        bytes calldata _routingPayload)
    external
    onlyRole(PROPOSER_ROLE) {
        hatVaults.swapBurnSend(
            _pid,
            _beneficiary,
            _amountOutMinimum,
            _routingContract,
            _routingPayload
        );
    }

    function setShares(
        uint256 _pid,
        uint256 _rewardPerShare,
        uint256 _balance,
        address[] memory _accounts,
        uint256[] memory _shares,
        uint256[] memory _rewardDebts)
    external
    onlyRole(PROPOSER_ROLE) {
        hatVaults.setShares(
            _pid,
            _rewardPerShare,
            _balance,
            _accounts,
            _shares,
            _rewardDebts
        );
    }
}
