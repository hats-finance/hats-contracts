// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "./LibAppStorage.sol";
import "./LibDiamond.sol";

library LibVaults {
    /**
     * @dev Update the pool's rewardPerShare, not more then once per block
     * @param _pid The pool id
     */
    function updatePool(uint256 _pid) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        PoolInfo storage pool = s.poolInfos[_pid];
        uint256 lastRewardBlock = pool.lastRewardBlock;
        if (block.number <= lastRewardBlock) {
            return;
        }
        uint256 totalShares = pool.totalShares;
        uint256 lastPoolUpdate = s.globalPoolUpdates.length-1;
        if (totalShares == 0) {
            pool.lastRewardBlock = block.number;
            pool.lastProcessedTotalAllocPoint = lastPoolUpdate;
            return;
        }
        uint256 reward = calcPoolReward(_pid, lastRewardBlock, lastPoolUpdate);
        pool.rewardPerShare = pool.rewardPerShare + (reward * 1e12 / totalShares);
        pool.lastRewardBlock = block.number;
        pool.lastProcessedTotalAllocPoint = lastPoolUpdate;
    }

    event SafeTransferReward(address indexed user, uint256 indexed pid, uint256 amount, uint256 requestedAmount);

    // Safe HAT transfer function, transfer HATs from the contract only if they are earmarked for rewards
    function safeTransferReward(address _to, uint256 _amount, uint256 _pid) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (_amount > s.hatRewardAvailable) { 
            _amount = s.hatRewardAvailable; 
        }
        s.hatRewardAvailable -= _amount;
        s.HAT.transfer(_to, _amount);
        // TODO: fix return of the requested amount
        emit SafeTransferReward(_to, _pid, _amount, _amount);
    }

    /**
     * @dev Calculate rewards for a pool by iterating over the history of totalAllocPoints updates,
     * and sum up all rewards periods from pool.lastRewardBlock until current block number.
     * @param _pid The pool id
     * @param _fromBlock The block from which to start calculation
     * @param _lastPoolUpdateIndex index of last PoolUpdate in globalPoolUpdates to calculate for
     * @return reward
     */
    function calcPoolReward(uint256 _pid, uint256 _fromBlock, uint256 _lastPoolUpdateIndex) public view returns(uint256 reward) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 poolAllocPoint = s.poolInfos[_pid].allocPoint;
        uint256 i = s.poolInfos[_pid].lastProcessedTotalAllocPoint;
        for (; i < _lastPoolUpdateIndex; i++) {
            uint256 nextUpdateBlock = s.globalPoolUpdates[i+1].blockNumber;
            reward =
            reward + getRewardForBlocksRange(_fromBlock,
                                            nextUpdateBlock,
                                            poolAllocPoint,
                                            s.globalPoolUpdates[i].totalAllocPoint);
            _fromBlock = nextUpdateBlock;
        }
        return reward + getRewardForBlocksRange(_fromBlock,
                                                block.number,
                                                poolAllocPoint,
                                                s.globalPoolUpdates[i].totalAllocPoint);
    }

    function getRewardForBlocksRange(uint256 _fromBlock, uint256 _toBlock, uint256 _allocPoint, uint256 _totalAllocPoint)
    internal
    view
    returns (uint256 reward) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (_totalAllocPoint > 0) {
            reward = getMultiplier(_fromBlock, _toBlock) * s.REWARD_PER_BLOCK * _allocPoint / _totalAllocPoint / 100;
        }
    }

    /**
     * @dev getMultiplier - multiply blocks with relevant multiplier for specific range
     * @param _fromBlock range's from block
     * @param _toBlock range's to block
     * will revert if from < START_BLOCK or _toBlock < _fromBlock
     */
    function getMultiplier(uint256 _fromBlock, uint256 _toBlock) internal view returns (uint256 result) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 i = (_fromBlock - s.START_BLOCK) / s.MULTIPLIER_PERIOD + 1;
        for (; i <= MULTIPLIERS_LENGTH; i++) {
            uint256 endBlock = s.MULTIPLIER_PERIOD * i + s.START_BLOCK;
            if (_toBlock <= endBlock) {
                break;
            }
            result += (endBlock - _fromBlock) * s.rewardMultipliers[i-1];
            _fromBlock = endBlock;
        }
        result += (_toBlock - _fromBlock) * (i > MULTIPLIERS_LENGTH ? 0 : s.rewardMultipliers[i-1]);
    }

    /**
    * @dev Check bounty levels.
    * Each level should be less than `HUNDRED_PERCENT`
    * If _bountyLevels length is 0, default bounty levels will be returned ([2000, 4000, 6000, 8000]).
    * @param _bountyLevels The bounty levels array
    * @return bountyLevels
    */
    function checkBountyLevels(uint256[] memory _bountyLevels)
    internal
    pure
    returns (uint256[] memory bountyLevels) {
        uint256 i;
        if (_bountyLevels.length == 0) {
            bountyLevels = new uint256[](4);
            for (i; i < 4; i++) {
              //defaultRewardLevels = [2000, 4000, 6000, 8000];
                bountyLevels[i] = 2000*(i+1);
            }
        } else {
            for (i; i < _bountyLevels.length; i++) {
                require(_bountyLevels[i] < HUNDRED_PERCENT, "HVE33");
            }
            bountyLevels = _bountyLevels;
        }
    }
    
    function validateSplit(BountySplit memory _bountySplit) internal pure {
        require(_bountySplit.hackerVested
            + _bountySplit.hacker
            + _bountySplit.committee
            + _bountySplit.swapAndBurn
            + _bountySplit.governanceHat
            + _bountySplit.hackerHat == HUNDRED_PERCENT,
        "HVE29");
    }

    function getDefaultBountySplit() internal pure returns (BountySplit memory) {
        return BountySplit({
            hackerVested: 6000,
            hacker: 2000,
            committee: 500,
            swapAndBurn: 0,
            governanceHat: 1000,
            hackerHat: 500
        });
    }
}