// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

interface IHATVaultsV1 {

    struct PoolInfo {
        address lpToken;
        uint256 allocPoint;
        uint256 lastRewardBlock;
        uint256 rewardPerShare;
        uint256 totalUsersAmount;
        uint256 lastProcessedTotalAllocPoint;
        uint256 balance;
    }

    struct UserInfo {
        uint256 amount;
        uint256 rewardDebt;
    }

    function poolInfo(uint256 _pid) external view returns (PoolInfo calldata poolInfo);

    function userInfo(uint256 _pid, address _user) external view returns (UserInfo calldata userInfo);
}
