// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "./SwapFacet.sol";

contract UIFacet is BaseFacet {
    // GET INFO for UI

    function getBountyLevels(uint256 _pid) external view returns(uint256[] memory) {
        return bountyInfos[_pid].bountyLevels;
    }

    function pendingReward(uint256 _pid, address _user) external view returns (uint256) {
        PoolInfo storage pool = poolInfos[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 rewardPerShare = pool.rewardPerShare;

        if (block.number > pool.lastRewardBlock && pool.totalShares > 0) {
            uint256 reward = calcPoolReward(_pid, pool.lastRewardBlock, globalPoolUpdates.length-1);
            rewardPerShare += (reward * 1e12 / pool.totalShares);
        }
        return user.shares * rewardPerShare / 1e12 - user.rewardDebt;
    }

    function getGlobalPoolUpdatesLength() external view returns (uint256) {
        return globalPoolUpdates.length;
    }

    function getNumberOfPools() external view returns (uint256) {
        return poolInfos.length;
    }
}