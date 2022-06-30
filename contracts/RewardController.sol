// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.14;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "./HATTimelockController.sol";

contract RewardController is Ownable {
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
        uint256 totalShares;
    }

    struct UserInfo {
        uint256 shares;     // The user share of the pool based on the shares of lpToken the user has provided.
        uint256 rewardDebt; // Reward debt. See explanation below.
        //
        // We do some fancy math here. Basically, any point in time, the amount of HATs
        // entitled to a user but is pending to be distributed is:
        //
        //   pending reward = (user.shares * pool.rewardPerShare) - user.rewardDebt
        //
        // Whenever a user deposits or withdraws LP tokens to a pool. Here's what happens:
        //   1. The pool's `rewardPerShare` (and `lastRewardBlock`) gets updated.
        //   2. User receives the pending reward sent to his/her address.
        //   3. User's `shares` gets updated.
        //   4. User's `rewardDebt` gets updated.
    }

    struct PoolUpdate {
        uint256 blockNumber;// update blocknumber
        uint256 totalAllocPoint; //totalAllocPoint
    }

    uint256 public constant MULTIPLIERS_LENGTH = 24;

    // Block from which the vaults contract will start rewarding.
    uint256 public immutable startBlock;
    uint256 public immutable epochLength;
    // the ERC20 contract in which rewards are distributed
    IERC20Upgradeable public immutable rewardToken;
    // Reward Multipliers
    uint256[24] public rewardPerEpoch;
    PoolUpdate[] public globalPoolUpdates;
    PoolInfo[] public poolInfos;
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    // rewardAvaivalabe is the amount of rewardToken's available to distribute as rewards
    uint256 public rewardAvailable;
    address public hatVaults;

    event SetRewardPerEpoch(uint256[24] _rewardPerEpoch);
    event SafeTransferReward(
        address indexed user,
        uint256 indexed pid,
        uint256 amount,
        address rewardToken
    );
    event ClaimReward(uint256 indexed _pid);
    event DepositReward(uint256 indexed _amount,
        uint256 indexed _transferredAmount,
        address indexed _rewardToken
    );
    event MassUpdatePools(uint256 _fromPid, uint256 _toPid);

    modifier onlyVaults() {
        if (hatVaults != msg.sender) revert OnlyHATVaults();
        _;
    }

    constructor(
        address _rewardToken,
        address _hatGovernance,
        uint256 _startRewardingBlock,
        uint256 _epochLength,
        uint256[24] memory _rewardPerEpoch

    // solhint-disable-next-line func-visibility
    ) {
        rewardToken = IERC20Upgradeable(_rewardToken);
        startBlock = _startRewardingBlock;
        epochLength = _epochLength;
        rewardPerEpoch = _rewardPerEpoch;
        _transferOwnership(_hatGovernance);
    }

    function setHATVaults(address _hatVaults) external onlyOwner {
        if (hatVaults != address(0)) revert OnlySetHATVaultsOnce();
        hatVaults = _hatVaults;
    }

    function _setAllocPoint(uint256 _pid, uint256 _allocPoint) internal {
        uint256 totalAllocPoint = (globalPoolUpdates.length == 0) ? _allocPoint :
        globalPoolUpdates[globalPoolUpdates.length-1].totalAllocPoint - poolInfos[_pid].allocPoint + _allocPoint;
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

        poolInfos[_pid].allocPoint = _allocPoint;
    }

    function setPoolsLastProcessedTotalAllocPoint(uint256 _pid) internal {
        uint globalPoolUpdatesLength = globalPoolUpdates.length;

        poolInfos[_pid].lastProcessedTotalAllocPoint = globalPoolUpdatesLength - 1;
    }

    /**
    * @notice Safe HAT transfer function, transfer rewards from the contract only if there are enough
    * rewards available.
    * @param _to The address to transfer the reward to
    * @param _amount The amount of rewards to transfer
    * @param _pid The pool id
   */
    function safeTransferReward(address _to, uint256 _amount, uint256 _pid) internal {
        if (rewardAvailable < _amount)
            revert NotEnoughRewardsToTransferToUser();
            
        rewardAvailable -= _amount;
        rewardToken.safeTransfer(_to, _amount);

        emit SafeTransferReward(_to, _pid, _amount, address(rewardToken));
    }

    /**
    * @notice Update the pool's rewardPerShare, not more then once per block
    * @param _pid The pool id
    */
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfos[_pid];
        uint256 lastRewardBlock = pool.lastRewardBlock;
        if (block.number <= lastRewardBlock) {
            return;
        }

        pool.lastRewardBlock = block.number;

        if (pool.totalShares != 0) {
            uint256 reward = getPoolReward(_pid, lastRewardBlock);
            pool.rewardPerShare += (reward * 1e12 / pool.totalShares);
        }

        setPoolsLastProcessedTotalAllocPoint(_pid);
    }

    function updateRewardPool(
        uint256 _pid,
        address _user,
        uint256 _userShares,
        uint256 _totalShares,
        bool _claimReward
    ) external onlyVaults {
        PoolInfo storage pool = poolInfos[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        updatePool(_pid);
        if (user.shares > 0 && _claimReward) {
            uint256 pending = user.shares * pool.rewardPerShare / 1e12 - user.rewardDebt;
            if (pending > 0) {
                safeTransferReward(_user, pending, _pid);
            }
        }

        pool.totalShares = _totalShares;
        user.shares = _userShares;
        user.rewardDebt = _userShares * pool.rewardPerShare / 1e12;
    }

    function addPool(uint256 _allocPoint) external onlyVaults {
        uint256 poolId = poolInfos.length;
        poolInfos.push(PoolInfo({
            lastRewardBlock: block.number > startBlock ? block.number : startBlock,
            lastProcessedTotalAllocPoint: 0,
            rewardPerShare: 0,
            totalShares: 0,
            allocPoint: 0
        }));
        _setAllocPoint(poolId, _allocPoint);
        setPoolsLastProcessedTotalAllocPoint(poolId);
    }

    /**
    * @notice set the shares of users in a pool
    * only calleable by the owner, and only when a pool is not initialized
    * This function is used for migrating older pool data to this new contract
    * (and this function can be removed in the next upgrade, because the current version is upgradeable)
    */
    function setShares(
        uint256 _pid,
        uint256 _rewardPerShare,
        address[] memory _accounts,
        uint256[] memory _shares,
        uint256[] memory _rewardDebts)
    external onlyVaults {
        PoolInfo storage pool = poolInfos[_pid];

        pool.rewardPerShare = _rewardPerShare;

        for (uint256 i = 0; i < _accounts.length; i++) {
            userInfo[_pid][_accounts[i]] = UserInfo({
                shares: _shares[i],
                rewardDebt: _rewardDebts[i]
            });
            pool.totalShares += _shares[i];
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

    function setAllocPoint(uint256 _pid, uint256 _allocPoint) external onlyOwner {
        _setAllocPoint(_pid, _allocPoint);
    }

    /**
     * @notice Transfer to the sender their pending share of rewards.
     * @param _pid The pool id
     */
    function claimReward(uint256 _pid) external {
        updatePool(_pid);

        UserInfo storage user = userInfo[_pid][msg.sender];
        uint256 rewardPerShare = poolInfos[_pid].rewardPerShare;
        if (user.shares > 0) {
            uint256 pending = user.shares * rewardPerShare / 1e12 - user.rewardDebt;
            if (pending > 0) {
                user.rewardDebt = user.shares * rewardPerShare / 1e12;
                safeTransferReward(msg.sender, pending, _pid);
            }
        }

        emit ClaimReward(_pid);
    }

    /**
     * @notice add reward tokens to the hatVaults contrac, to be distributed as rewards
     * The sender of the transaction must have approved the spend before calling this function
     * @param _amount amount of rewardToken to add
    */
    function depositReward(uint256 _amount) external {
        uint256 balanceBefore = rewardToken.balanceOf(address(this));
        rewardToken.safeTransferFrom(msg.sender, address(this), _amount);
        uint256 rewardTokenReceived = rewardToken.balanceOf(address(this)) - balanceBefore;
        rewardAvailable += rewardTokenReceived;

        emit DepositReward(_amount, rewardTokenReceived, address(rewardToken));
    }

    /**
    * @notice massUpdatePools - Update reward variables for all pools
    * Be careful of gas spending!
    * @param _fromPid update pools range from this pool id
    * @param _toPid update pools range to this pool id
    */
    function massUpdatePools(uint256 _fromPid, uint256 _toPid) external {
        if (_toPid > poolInfos.length || _fromPid > _toPid)
            revert InvalidPoolRange();

        for (uint256 pid = _fromPid; pid < _toPid; ++pid) {
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
        uint256 poolAllocPoint = poolInfos[_pid].allocPoint;
        uint256 i = poolInfos[_pid].lastProcessedTotalAllocPoint;
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
        PoolInfo memory pool = poolInfos[_pid];
        UserInfo memory user = userInfo[_pid][_user];
        uint256 rewardPerShare = pool.rewardPerShare;

        if (block.number > pool.lastRewardBlock && pool.totalShares > 0) {
            uint256 reward = getPoolReward(_pid, pool.lastRewardBlock);
            rewardPerShare += (reward * 1e12 / pool.totalShares);
        }

        return user.shares * rewardPerShare / 1e12 - user.rewardDebt;
    }

    function getGlobalPoolUpdatesLength() external view returns (uint256) {
        return globalPoolUpdates.length;
    }

}
