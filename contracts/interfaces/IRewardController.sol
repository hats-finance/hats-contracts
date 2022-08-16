// SPDX-License-Identifier: MIT
pragma solidity 0.8.14;


interface IRewardController {
    function updateVaultBalance(address _user, uint256 _sharesChange, bool _isDeposit) external;

    function setAllocPoint(address _vault, uint256 _allocPoint) external;
}