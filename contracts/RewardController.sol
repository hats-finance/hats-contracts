// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.6;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./HATVaults.sol";

contract RewardController is Ownable {

    struct PoolUpdate {
        uint256 blockNumber;// update blocknumber
        uint256 totalAllocPoint; //totalAllocPoint
    }

    uint256 public constant MULTIPLIERS_LENGTH = 24;

    // Block from which the vaults contract will start rewarding.
    uint256 public startBlock;
    uint256 public epochLength;
    // Reward Multipliers
    uint256[24] public rewardPerEpoch;
    PoolUpdate[] public globalPoolUpdates;
    mapping(uint256 => uint256) public poolsAllocPoint;
    HATVaults public hatVaults;

    event SetRewardPerEpoch(uint256[24] _rewardPerEpoch);

    constructor(
        address _hatGovernance,
        HATVaults _hatVaults,
        uint256 _startRewardingBlock,
        uint256 _epochLength,
        uint256[24] memory _rewardPerEpoch
    // solhint-disable-next-line func-visibility
    ) {
        startBlock = _startRewardingBlock;
        epochLength = _epochLength;
        rewardPerEpoch = _rewardPerEpoch;
        hatVaults = _hatVaults;
        _transferOwnership(_hatGovernance);
    }

    /**
     * @dev setRewardPerEpoch- called by hats governance to set reward multipliers
     * @param _rewardPerEpoch reward multipliers
    */
    function setRewardPerEpoch(uint256[24] memory _rewardPerEpoch) external onlyOwner {
        rewardPerEpoch = _rewardPerEpoch;
        emit SetRewardPerEpoch(_rewardPerEpoch);
    }

    function setAllocPoint(uint256 _pid, uint256 _allocPoint) external onlyOwner {
        // hatVaults.updatePool(_pid);
        uint256 totalAllocPoint = (globalPoolUpdates.length == 0) ? _allocPoint :
        globalPoolUpdates[globalPoolUpdates.length-1].totalAllocPoint - poolsAllocPoint[_pid] + _allocPoint;
        if (globalPoolUpdates.length > 0 &&
            globalPoolUpdates[globalPoolUpdates.length-1].blockNumber == block.number) {
            // already update in this block
            globalPoolUpdates[globalPoolUpdates.length-1].totalAllocPoint = totalAllocPoint;
        } else {
            globalPoolUpdates.push(PoolUpdate({
                blockNumber: block.number,
                totalAllocPoint: totalAllocPoint
            }));
        }

        poolsAllocPoint[_pid] = _allocPoint;
    }



    /**
    * @dev Calculate rewards for a pool by iterating over the history of totalAllocPoints updates,
    * and sum up all rewards periods from pool.lastRewardBlock until current block number.
    * @param _pid The pool id
    * @param _fromBlock The block from which to start calculation
    * @return reward
    */
    function getPoolReward(uint256 _pid, uint256 _fromBlock, uint256 _lastProcessedAllocPoint) external view returns(uint256 reward) {
        uint256 poolAllocPoint = poolsAllocPoint[_pid];
        uint256 i = _lastProcessedAllocPoint;
        for (; i < globalPoolUpdates.length-1; i++) {
            uint256 nextUpdateBlock = globalPoolUpdates[i+1].blockNumber;
            reward =
            reward + getRewardForBlocksRange(_fromBlock,
                                            nextUpdateBlock,
                                            poolAllocPoint,
                                            globalPoolUpdates[i].totalAllocPoint);
            _fromBlock = nextUpdateBlock;
        }
        return reward + getRewardForBlocksRange(_fromBlock,
                                                block.number,
                                                poolAllocPoint,
                                                globalPoolUpdates[i].totalAllocPoint);
    }

    function getRewardForBlocksRange(uint256 _fromBlock, uint256 _toBlock, uint256 _allocPoint, uint256 _totalAllocPoint)
    public
    view
    returns (uint256 reward) {
        if (_totalAllocPoint > 0) {
            uint256 result;
            uint256 i = (_fromBlock - startBlock) / epochLength + 1;
            for (; i <= MULTIPLIERS_LENGTH; i++) {
                uint256 endBlock = epochLength * i + startBlock;
                if (_toBlock <= endBlock) {
                    break;
                }
                result += (endBlock - _fromBlock) * rewardPerEpoch[i-1];
                _fromBlock = endBlock;
            }
            result += (_toBlock - _fromBlock) * (i > MULTIPLIERS_LENGTH ? 0 : rewardPerEpoch[i-1]);
            reward = result * _allocPoint / _totalAllocPoint / 100;
        }
    }

    function getGlobalPoolUpdatesLength() external view returns (uint256) {
        return globalPoolUpdates.length;
    }

}
