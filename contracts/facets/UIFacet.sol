// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "../libraries/LibAppStorage.sol";
import "../libraries/LibVaults.sol";

contract UIFacet {
    AppStorage internal s;

    function HAT() external view returns(address) {
        return address(s.HAT);
    }

    function generalParameters() external view returns(GeneralParameters memory) {
        return s.generalParameters;
    }

    function poolInfos(uint256 _idx) external view returns(PoolInfo memory _poolInfo) {
        return s.poolInfos[_idx];
    }

    function globalPoolUpdates(uint256 _idx) external view returns(PoolUpdate memory _poolUpdate) {
        return s.globalPoolUpdates[_idx];
    }

    function userInfo(uint256 _pid, address _user) external view returns(UserInfo memory _userInfo) {
        return s.userInfo[_pid][_user];
    }

    function committees(uint256 _pid) external view returns(address _committee) {
        return s.committees[_pid];
    }

    function withdrawEnableStartTime(uint256 _pid, address _user) external view returns(uint256 _requestTime) {
        return s.withdrawEnableStartTime[_pid][_user];
    }

    function feeSetter() external view returns(address _feeSetter) {
        return s.feeSetter;
    }

    function uniSwapRouter() external view returns(ISwapRouter _uniSwapRouter) {
        return s.uniSwapRouter;
    }

    function getBountyLevels(uint256 _pid) external view returns(uint256[] memory) {
        return s.bountyInfos[_pid].bountyLevels;
    }

    function getBountyInfo(uint256 _pid) external view returns(BountyInfo memory) {
        return s.bountyInfos[_pid];
    }

    // GET INFO for UI
    /**
    * @dev Return the current pool reward per block
    * @param _pid The pool id.
    *        if _pid = 0 , it returns the current block reward for all the pools.
    *        otherwise it returns the current block reward for _pid-1.
    * @return rewardPerBlock
    **/
    function getRewardPerBlock(uint256 _pid) external view returns (uint256) {
        if (_pid == 0) {
            return LibVaults.getRewardForBlocksRange(block.number-1, block.number, 1, 1);
        } else {
            return LibVaults.getRewardForBlocksRange(block.number-1,
                                        block.number,
                                        s.poolInfos[_pid - 1].allocPoint,
                                        s.globalPoolUpdates[s.globalPoolUpdates.length-1].totalAllocPoint);
        }
    }

    function getRewardForBlocksRange(uint256 _fromBlock, uint256 _toBlock, uint256 _allocPoint, uint256 _totalAllocPoint) external view returns (uint256) {
        return LibVaults.getRewardForBlocksRange(_fromBlock, _toBlock, _allocPoint, _totalAllocPoint);
    }

    function getMultiplier(uint256 _fromBlock, uint256 _toBlock) external view returns (uint256) {
        return LibVaults.getMultiplier(_fromBlock, _toBlock);
    }

    function pendingReward(uint256 _pid, address _user) external view returns (uint256) {
        PoolInfo storage pool = s.poolInfos[_pid];
        UserInfo storage user = s.userInfo[_pid][_user];
        uint256 rewardPerShare = pool.rewardPerShare;

        if (block.number > pool.lastRewardBlock && pool.totalShares > 0) {
            uint256 reward = LibVaults.calcPoolReward(_pid, pool.lastRewardBlock, s.globalPoolUpdates.length-1);
            rewardPerShare += (reward * 1e12 / pool.totalShares);
        }
        return user.shares * rewardPerShare / 1e12 - user.rewardDebt;
    }

    function getGlobalPoolUpdatesLength() external view returns (uint256) {
        return s.globalPoolUpdates.length;
    }

    function getStakedAmount(uint _pid, address _user) external view returns (uint256) {
        UserInfo storage user = s.userInfo[_pid][_user];
        return  user.shares;
    }

    function poolLength() external view returns (uint256) {
        return s.poolInfos.length;
    }
}