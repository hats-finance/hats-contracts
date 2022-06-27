// SPDX-License-Identifier: MIT
pragma solidity 0.8.14;

import "./Base.sol";

contract Getters is Base {

    /**
     * @notice calculate the amount of rewards an account can claim for having contributed to a specific pool
     * @param _pid the id of the pool
     * @param _user the account for which the reward is calculated
    */
    function getPendingReward(uint256 _pid, address _user) external view returns (uint256) {
        PoolInfo storage pool = poolInfos[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 rewardPerShare = pool.rewardPerShare;

        if (block.number > pool.lastRewardBlock && pool.totalShares > 0) {
            uint256 reward = getPoolReward(_pid, pool.lastRewardBlock);
            rewardPerShare += (reward * 1e12 / pool.totalShares);
        }

        return user.shares * rewardPerShare / 1e12 - user.rewardDebt;
    }

    function getNumberOfPools() external view returns (uint256) {
        return poolInfos.length;
    }

    function getGlobalPoolUpdatesLength() external view returns (uint256) {
        return globalPoolUpdates.length;
    }
}
