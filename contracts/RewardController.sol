// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.14;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "./HATVaults.sol";

contract RewardController is IRewardController, OwnableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    // Not enough rewards to transfer to user
    error OnlyHATVaults();
    error OnlySetHATVaultsOnce();
    error NotEnoughRewardsToTransferToUser();
    error InvalidPoolRange();


    struct PoolInfo {
        uint256 rewardPerShare;
        uint256 lastProcessedTotalAllocPoint;
        uint256 lastRewardBlock;
        uint256 allocPoint;
    }

    struct PoolUpdate {
        uint256 blockNumber;// update blocknumber
        uint256 totalAllocPoint; //totalAllocPoint
    }

    uint256 public constant MULTIPLIERS_LENGTH = 24;

    // Block from which the vaults contract will start rewarding.
    uint256 public startBlock;
    uint256 public epochLength;
    // the ERC20 contract in which rewards are distributed
    IERC20Upgradeable public rewardToken;
    // Reward Multipliers
    uint256[24] public rewardPerEpoch;
    PoolUpdate[] public globalPoolUpdates;
    mapping(uint256 => PoolInfo) public poolInfo;
    mapping(uint256 => mapping(address => uint256)) public rewardDebt;
    HATVaults public hatVaults;

    event SetRewardPerEpoch(uint256[24] _rewardPerEpoch);
    event SafeTransferReward(
        address indexed user,
        uint256 indexed pid,
        uint256 amount,
        address rewardToken
    );
    event ClaimReward(uint256 indexed _pid);
    event MassUpdatePools(uint256 _fromPid, uint256 _toPid);

    modifier onlyVaults() {
        if (address(hatVaults) != msg.sender) revert OnlyHATVaults();
        _;
    }

    function initialize(
        address _rewardToken,
        address _hatGovernance,
        uint256 _startRewardingBlock,
        uint256 _epochLength,
        uint256[24] memory _rewardPerEpoch
    ) external initializer {
        rewardToken = IERC20Upgradeable(_rewardToken);
        startBlock = _startRewardingBlock;
        epochLength = _epochLength;
        rewardPerEpoch = _rewardPerEpoch;
        _transferOwnership(_hatGovernance);
    }

    function setHATVaults(HATVaults _hatVaults) external onlyOwner {
        if (address(hatVaults) != address(0)) revert OnlySetHATVaultsOnce();
        hatVaults = _hatVaults;
    }

    function setAllocPoint(uint256 _pid, uint256 _allocPoint) external onlyOwner {
        if (poolInfo[_pid].lastRewardBlock == 0) {
            poolInfo[_pid].lastRewardBlock = block.number > startBlock ? block.number : startBlock;
        }
        updatePool(_pid);
        uint256 totalAllocPoint = (globalPoolUpdates.length == 0) ? _allocPoint :
        globalPoolUpdates[globalPoolUpdates.length-1].totalAllocPoint - poolInfo[_pid].allocPoint + _allocPoint;
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

        poolInfo[_pid].allocPoint = _allocPoint;
    }

    function setPoolsLastProcessedTotalAllocPoint(uint256 _pid) internal {
        uint globalPoolUpdatesLength = globalPoolUpdates.length;

        poolInfo[_pid].lastProcessedTotalAllocPoint = globalPoolUpdatesLength - 1;
    }

    /**
    * @notice Safe HAT transfer function, transfer rewards from the contract only if there are enough
    * rewards available.
    * @param _to The address to transfer the reward to
    * @param _amount The amount of rewards to transfer
    * @param _pid The pool id
   */
    function safeTransferReward(address _to, uint256 _amount, uint256 _pid) internal {
        if (rewardToken.balanceOf(address(this)) < _amount)
            revert NotEnoughRewardsToTransferToUser();
            
        rewardToken.safeTransfer(_to, _amount);

        emit SafeTransferReward(_to, _pid, _amount, address(rewardToken));
    }

    /**
    * @notice Update the pool's rewardPerShare, not more then once per block
    * @param _pid The pool id
    */
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        uint256 lastRewardBlock = pool.lastRewardBlock;
        if (block.number <= lastRewardBlock) {
            return;
        }

        pool.lastRewardBlock = block.number;

        uint256 totalShares = getTotalShares(_pid);

        if (totalShares != 0) {
            uint256 reward = getPoolReward(_pid, lastRewardBlock);
            pool.rewardPerShare += (reward * 1e12 / totalShares);
        }

        setPoolsLastProcessedTotalAllocPoint(_pid);
    }

    /**
    * @notice set the shares of users in a pool
    * only calleable by the owner, and only when a pool is not initialized
    * This function is used for migrating older pool data to this new contract
    */
    function setShares(
        uint256 _pid,
        uint256 _rewardPerShare,
        address[] memory _accounts,
        uint256[] memory _rewardDebts)
    external onlyVaults {
        PoolInfo storage pool = poolInfo[_pid];

        pool.rewardPerShare = _rewardPerShare;

        for (uint256 i = 0; i < _accounts.length; i++) {
            rewardDebt[_pid][_accounts[i]] = _rewardDebts[i];
        }
    }

    /**
     * @notice Called by owner to set reward multipliers
     * @param _rewardPerEpoch reward multipliers
    */
    function setRewardPerEpoch(uint256[24] memory _rewardPerEpoch) external onlyOwner {
        rewardPerEpoch = _rewardPerEpoch;
        emit SetRewardPerEpoch(_rewardPerEpoch);
    }

    function _updateRewardPool(
        uint256 _pid,
        address _user,
        uint256 _sharesChange,
        bool _isDeposit,
        bool _claimReward
    ) internal {
        updatePool(_pid);

        uint256 userShares = getShares(_pid, _user);
        uint256 rewardPerShare = poolInfo[_pid].rewardPerShare;
        uint256 pending = userShares * rewardPerShare / 1e12 - rewardDebt[_pid][_user];
        if (_sharesChange != 0) {
            if (_isDeposit) {
                userShares += _sharesChange;
            } else {
                userShares -= _sharesChange;
            }
        }
        rewardDebt[_pid][_user] = userShares * rewardPerShare / 1e12;
        if (pending > 0 && _claimReward) {
            safeTransferReward(_user, pending, _pid);
        }
    }

    function updateRewardPool(
        uint256 _pid,
        address _user,
        uint256 _sharesChange,
        bool _isDeposit,
        bool _claimReward
    ) external onlyVaults {
        _updateRewardPool(_pid, _user, _sharesChange, _isDeposit, _claimReward);
    }

    /**
     * @notice Transfer to the sender their pending share of rewards.
     * @param _pid The pool id
     */
    function claimReward(uint256 _pid) external {
        _updateRewardPool(_pid, msg.sender, 0, true, true);

        emit ClaimReward(_pid);
    }

    /**
    * @notice massUpdatePools - Update reward variables for all pools
    * Be careful of gas spending!
    * @param _fromPid update pools range from this pool id
    * @param _toPid update pools range to this pool id
    */
    function massUpdatePools(uint256 _fromPid, uint256 _toPid) external {
        if (_fromPid > _toPid)
            revert InvalidPoolRange();

        for (uint256 pid = _fromPid; pid < _toPid; ++pid) {
            if (poolInfo[pid].lastRewardBlock == 0) {
                revert InvalidPoolRange();
            }
            updatePool(pid);
        }

        emit MassUpdatePools(_fromPid, _toPid);
    }

     /**
    * @notice Calculate rewards for a pool by iterating over the history of totalAllocPoints updates,
    * and sum up all rewards periods from pool.lastRewardBlock until current block number.
    * @param _pid The pool id
    * @param _fromBlock The block from which to start calculation
    * @return reward
    */
    function getPoolReward(uint256 _pid, uint256 _fromBlock) public view returns(uint256 reward) {
        uint256 poolAllocPoint = poolInfo[_pid].allocPoint;
        uint256 i = poolInfo[_pid].lastProcessedTotalAllocPoint;
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

    /**
     * @notice calculate the amount of rewards an account can claim for having contributed to a specific pool
     * @param _pid the id of the pool
     * @param _user the account for which the reward is calculated
    */
    function getPendingReward(uint256 _pid, address _user) external view returns (uint256) {
        PoolInfo memory pool = poolInfo[_pid];
        uint256 rewardPerShare = pool.rewardPerShare;
        uint256 totalShares = getTotalShares(_pid);

        if (block.number > pool.lastRewardBlock && totalShares > 0) {
            uint256 reward = getPoolReward(_pid, pool.lastRewardBlock);
            rewardPerShare += (reward * 1e12 / totalShares);
        }

        return getShares(_pid, _user) * rewardPerShare / 1e12 - rewardDebt[_pid][_user];
    }

    function getTotalShares(uint256 _pid) public view returns (uint256 totalShares) {
        ( , , , totalShares, , ) = hatVaults.poolInfos(_pid);
    }

    function getShares(uint256 _pid, address _user) public view returns (uint256) {
        return hatVaults.userShares(_pid, _user);
    }

    function getGlobalPoolUpdatesLength() external view returns (uint256) {
        return globalPoolUpdates.length;
    }

}
