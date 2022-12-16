// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "../HATVaultsRegistry.sol";
import "../RewardController.sol";
//this contract is used as an helper contract only for testing purpose

contract VaultsManagerMock {

    function createVaults(HATVaultsRegistry _hatVaults,
                    IRewardController _rewardController,
                    uint256 _allocPoint,
                    IERC20[] memory _assets,
                    address _committee,
                    uint16 _maxBounty,
                    HATVault.BountySplit memory _bountySplit,
                    string memory _descriptionHash
                    ) external {

        IRewardController[] memory _rewardControllers = new IRewardController[](1);
        _rewardControllers[0] = _rewardController;
        for (uint256 i=0; i < _assets.length; i++) {
            address vault = _hatVaults.createVault(IHATVault.VaultInitParams({
                                    asset: _assets[i],
                                    owner: _hatVaults.owner(),
                                    committee: _committee,
                                    name: "VAULT",
                                    symbol: "VLT",
                                    rewardControllers: _rewardControllers,
                                    maxBounty: _maxBounty,
                                    bountySplit: _bountySplit,
                                    descriptionHash: _descriptionHash,
                                    vestingDuration: 86400,
                                    vestingPeriods: 10,
                                    isPaused: false
                                }));
            _rewardController.setAllocPoint(vault, _allocPoint);
        }
    }

    function setVaultsAllocPoint(HATVault[] memory _hatVaults, IRewardController _rewardController, uint256 _allocPoint) external {
        for (uint256 i=0; i < _hatVaults.length; i++) {
            _rewardController.setAllocPoint(address(_hatVaults[i]), _allocPoint);
        }
    }

    function claimRewardTwice(RewardController target, address _vault) external {
        target.claimReward(_vault, address(this));
        target.claimReward(_vault, address(this));
    }

    function deposit(HATVault _target, IERC20 _asset, uint256 _amount) external {
        _asset.approve(address(_target), _amount);
        _target.deposit(_amount, address(this));
    }

    function depositTwice(HATVault _target, IERC20 _asset, uint256 _amount) external {
        _asset.approve(address(_target), _amount * 2);
        _target.deposit(_amount, address(this));
        _target.deposit(_amount, address(this));
    }

    function claimDifferentPids(RewardController _target, address[] memory _vaults) external {
        uint256 i;
        for (i = 0; i < _vaults.length; i++) {
            _target.claimReward(_vaults[i], address(this));
        }
    }

}
