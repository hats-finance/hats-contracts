// SPDX-License-Identifier: MIT
pragma solidity 0.8.14;

import "../HATVaultsRegistry.sol";
import "../RewardController.sol";

//this contract is used as an helper contract only for testing purpose

contract VaultsManagerMock {

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
