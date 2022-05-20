// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "./Swap.sol";

contract Getters is Swap {
    // GET INFO for UI

    function getBountyInfo(uint256 _pid) external view returns(BountyInfo memory) {
        return bountyInfos[_pid];
    }

    function getBountyLevels(uint256 _pid) external view returns(uint256[] memory) {
        return bountyInfos[_pid].bountyLevels;
    }

    /**
    * @dev Return the current pool reward per block
    * @param _pid The pool id.
    *        if _pid = 0 , it returns the current block reward for all the pools.
    *        otherwise it returns the current block reward for _pid-1.
    * @return rewardPerBlock
    **/
    function getRewardPerBlock(uint256 _pid) external view returns (uint256) {
        if (_pid == 0) {
            return getRewardForBlocksRange(block.number-1, block.number, 1, 1);
        } else {
            return getRewardForBlocksRange(block.number-1,
                                        block.number,
                                        poolInfos[_pid - 1].allocPoint,
                                        globalPoolUpdates[globalPoolUpdates.length-1].totalAllocPoint);
        }
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

    function getStakedAmount(uint _pid, address _user) external view returns (uint256) {
        UserInfo storage user = userInfo[_pid][_user];
        return  user.shares;
    }

    function getNumberOfPools() external view returns (uint256) {
        return poolInfos.length;
    }
}