// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;


contract HATVaultsV1Mock {
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

    PoolInfo[] public poolInfo;
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;

    function addShares(uint256 pid, address account, uint256 shares) external {
        while (pid >= poolInfo.length) {
            poolInfo.push(PoolInfo({
                lpToken: address(0),
                allocPoint: 0,
                lastRewardBlock: 0,
                rewardPerShare: 0,
                totalUsersAmount: 0,
                lastProcessedTotalAllocPoint: 0,
                balance: 0
            }));
        }

        poolInfo[pid].totalUsersAmount += shares;
        userInfo[pid][account].amount += shares;
    }
}
