// SPDX-License-Identifier: MIT
pragma solidity 0.8.14;


interface IRewardController {
    function setShares(
        uint256 _pid,
        uint256 _rewardPerShare,
        address[] memory _accounts,
        uint256[] memory _rewardDebts)
    external;

    function updateRewardPool(
        uint256 _pid,
        address _user,
        uint256 _sharesChange,
        bool _isDeposit,
        bool _claimReward
    ) external;

    function setAllocPoint(uint256 _pid, uint256 _allocPoint) external;
}