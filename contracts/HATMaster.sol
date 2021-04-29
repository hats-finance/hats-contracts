// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;


import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/utils/SafeERC20.sol";
import "openzeppelin-solidity/contracts/utils/math/SafeMath.sol";
import "./HATToken.sol";


contract HATMaster {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    struct UserInfo {
        uint256 amount;     // How many LP tokens the user has provided.
        uint256 rewardDebt; // Reward debt. See explanation below.
    }

    struct PoolUpdate {
        uint256 blockNumber;// update blocknumber
        uint256 totalAllocPoint; //totalAllocPoint
    }

    // Info of each pool.
    struct PoolInfo {
        IERC20 lpToken;
        uint256 allocPoint;
        uint256 lastRewardBlock;
        uint256 rewardPerShare;
        uint256 totalUsersAmount;
        uint256 lastProcessedTotalAllocPoint;
    }

    // Info of each pool.
    struct PoolReward {
        uint256 pendingLpTokenRewards;
        uint256 hackerRewardSplit;
        uint256 approverRewardSplit;
        uint256 swapAndBurnSplit;
        uint256 hackerHatRewardSplit;
        uint256[]  rewardsLevels;
        bool committeeCheckIn;
        uint256 vestingDuration;
        uint256 vestingPeriods;
        bool approvalPaused;
    }

    HATToken public immutable HAT;

    uint256 public immutable REWARD_PER_BLOCK;
    uint256[] public REWARD_MULTIPLIER = [688, 413, 310, 232, 209, 188, 169, 152, 137, 123, 111, 100];
    uint256[] public HALVING_AT_BLOCK;

    uint256 public immutable START_BLOCK;

    // Info of each pool.
    PoolInfo[] public poolInfo;
    //blockNumber to index in globalPoolUpdates
    mapping(uint256 => uint256) public totalAllocPointUpdatedAtBlock;
    PoolUpdate[] public globalPoolUpdates;
    mapping(address => uint256) public poolId1; // poolId1 count from 1, subtraction 1 before using with poolInfo
    // Info of each user that stakes LP tokens. pid => user address => info
    mapping (uint256 => mapping (address => UserInfo)) public userInfo;
    //pid -> PoolReward
    mapping (uint256=>PoolReward) internal poolsRewards;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event SendReward(address indexed user, uint256 indexed pid, uint256 amount, uint256 requestedAmount);
    event MassUpdatePools(uint256 _fromPid, uint256 _toPid);

    constructor(
        HATToken _HAT,
        uint256 _rewardPerBlock,
        uint256 _startBlock,
        uint256 _halvingAfterBlock
    ) {
        HAT = _HAT;
        REWARD_PER_BLOCK = _rewardPerBlock;
        START_BLOCK = _startBlock;
        for (uint256 i = 0; i < REWARD_MULTIPLIER.length - 1; i++) {
            uint256 halvingAtBlock = _halvingAfterBlock.mul(i + 1).add(_startBlock);
            HALVING_AT_BLOCK.push(halvingAtBlock);
        }
        HALVING_AT_BLOCK.push(type(uint256).max);
    }

  /**
   * @dev massUpdatePools - Update reward vairables for all pools
   * Be careful of gas spending!
   * @param _fromPid update pools range from this pool id
   * @param _toPid update pools range to this pool id
   */
    function massUpdatePools(uint256 _fromPid, uint256 _toPid) external {
        require(_toPid <= poolInfo.length, "pool range is too big");
        require(_fromPid <= _toPid, "invalid pool range");
        for (uint256 pid = _fromPid; pid < _toPid; ++pid) {
            updatePool(pid);
        }
        emit MassUpdatePools(_fromPid, _toPid);
    }

    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }

        if (pool.totalUsersAmount == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        uint256 reward = getPoolRewardLoop(_pid);
        //the original BDPMaster was reverted if the reward is zero to to the cap check of at the BDP token.
        if (reward > 0) {
            HAT.mint(address(this), reward);
        }

        pool.rewardPerShare = pool.rewardPerShare.add(reward.mul(1e12).div(pool.totalUsersAmount));
        pool.lastRewardBlock = block.number;
        pool.lastProcessedTotalAllocPoint = globalPoolUpdates.length-1;
    }

    // --------- For user ----------------
    function deposit(uint256 _pid, uint256 _amount) public {
        require(poolsRewards[_pid].committeeCheckIn, "committee not checked in yet");
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        updatePool(_pid);
        if (user.amount > 0) {
            uint256 pending = user.amount.mul(pool.rewardPerShare).div(1e12).sub(user.rewardDebt);
            if (pending > 0) {
                safeTransferReward(msg.sender, pending, _pid);
            }
        }
        if (_amount > 0) {
            uint256 lpSupply = pool.lpToken.balanceOf(address(this)).sub(poolsRewards[_pid].pendingLpTokenRewards);
            pool.lpToken.safeTransferFrom(address(msg.sender), address(this), _amount);
            uint256 factoredAmount = _amount;
            if (pool.totalUsersAmount > 0) {
                factoredAmount = pool.totalUsersAmount.mul(_amount).div(lpSupply);
            }
            user.amount = user.amount.add(factoredAmount);
            pool.totalUsersAmount = pool.totalUsersAmount.add(factoredAmount);
        }
        user.rewardDebt = user.amount.mul(pool.rewardPerShare).div(1e12);
        emit Deposit(msg.sender, _pid, _amount);
    }

    function claimReward(uint256 _pid) public {
        deposit(_pid, 0);
    }

    // GET INFO for UI
    function getMultiplier(uint256 _from, uint256 _to) public view returns (uint256 result) {
        if (_from < START_BLOCK) return 0;

        for (uint256 i = 0; i < HALVING_AT_BLOCK.length; i++) {
            uint256 endBlock = HALVING_AT_BLOCK[i];

            if (_to <= endBlock) {
                uint256 m = _to.sub(_from).mul(REWARD_MULTIPLIER[i]);
                return result.add(m);
            }

            if (_from < endBlock) {
                uint256 m = endBlock.sub(_from).mul(REWARD_MULTIPLIER[i]);
                _from = endBlock;
                result = result.add(m);
            }
        }
    }

    function getPoolReward(uint256 _from, uint256 _to, uint256 _allocPoint, uint256 _totalAllocPoint)
    public
    view
    returns (uint) {
        uint256 multiplier = getMultiplier(_from, _to);
        uint256 amount = (multiplier.mul(REWARD_PER_BLOCK).mul(_allocPoint).div(_totalAllocPoint)).div(100);
        uint256 amountCanMint = HAT.minters(address(this));
        return amountCanMint < amount ? amountCanMint : amount;
    }

    function getRewardPerBlock(uint256 pid1) public view returns (uint256) {
        uint256 multiplier = getMultiplier(block.number -1, block.number);
        if (pid1 == 0) {
            return (multiplier.mul(REWARD_PER_BLOCK)).div(100);
        } else {
            return (multiplier
                .mul(REWARD_PER_BLOCK)
                .mul(poolInfo[pid1 - 1].allocPoint)
                .div(globalPoolUpdates[globalPoolUpdates.length-1].totalAllocPoint))
                .div(100);
        }
    }

    function pendingReward(uint256 _pid, address _user) public view returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 rewardPerShare = pool.rewardPerShare;
        if (block.number > pool.lastRewardBlock && pool.totalUsersAmount > 0) {
            uint256 reward = getPoolRewardLoop(_pid);
            rewardPerShare = rewardPerShare.add(reward.mul(1e12).div(pool.totalUsersAmount));
        }
        return user.amount.mul(rewardPerShare).div(1e12).sub(user.rewardDebt);
    }

    function poolLength() public view returns (uint256) {
        return poolInfo.length;
    }

    function getGlobalPoolUpdatesLength() public view returns (uint256) {
        return globalPoolUpdates.length;
    }

    function getStakedAmount(uint _pid, address _user) public view returns (uint256) {
        UserInfo storage user = userInfo[_pid][_user];
        return  user.amount;
    }

    function getPoolRewardLoop(uint256 _pid) public view returns(uint256 reward) {
        uint256 globalPoolUpdatesLength = globalPoolUpdates.length;
        uint256 index = poolInfo[_pid].lastProcessedTotalAllocPoint;
        uint256 from = poolInfo[_pid].lastRewardBlock;
        uint256 poolAllocPoint = poolInfo[_pid].allocPoint;

        for (index; index < globalPoolUpdatesLength; index++) {
            if (globalPoolUpdates[index].blockNumber > from) {
               break;
            }
        }

        if (index >= globalPoolUpdatesLength) {
            return getPoolReward(from,
            block.number,
            poolAllocPoint,
            globalPoolUpdates[globalPoolUpdatesLength-1].totalAllocPoint);
        }

        for (index; index < globalPoolUpdatesLength; index++) {
            reward = reward.add(getPoolReward(from,
            globalPoolUpdates[index].blockNumber,
            poolAllocPoint,
            globalPoolUpdates[index-1].totalAllocPoint));
            from = globalPoolUpdates[index].blockNumber;
        }

        return reward.add(getPoolReward(from,
                block.number,
                poolAllocPoint,
                globalPoolUpdates[globalPoolUpdatesLength-1].totalAllocPoint));
    }

    function _withdraw(uint256 _pid, uint256 _amount) internal {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        uint256 lpSupply = pool.lpToken.balanceOf(address(this)).sub(poolsRewards[_pid].pendingLpTokenRewards);
        require(user.amount >= _amount, "withdraw: not enough user balance");

        updatePool(_pid);
        uint256 pending = user.amount.mul(pool.rewardPerShare).div(1e12).sub(user.rewardDebt);
        if (pending > 0) {
            safeTransferReward(msg.sender, pending, _pid);
        }
        if (_amount > 0) {
            user.amount = user.amount.sub(_amount);
            pool.lpToken.safeTransfer(address(msg.sender), _amount.mul(lpSupply).div(pool.totalUsersAmount));
            pool.totalUsersAmount = pool.totalUsersAmount.sub(_amount);

        }
        user.rewardDebt = user.amount.mul(pool.rewardPerShare).div(1e12);
        emit Withdraw(msg.sender, _pid, _amount);
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function _emergencyWithdraw(uint256 _pid) internal {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.amount > 0, "user.amount = 0");

        uint256 lpSupply = pool.lpToken.balanceOf(address(this)).sub(poolsRewards[_pid].pendingLpTokenRewards);
        uint256 factoredBalance = user.amount.mul(lpSupply).div(pool.totalUsersAmount);
        pool.totalUsersAmount = pool.totalUsersAmount.sub(user.amount);
        user.amount = 0;
        user.rewardDebt = 0;
        pool.lpToken.safeTransfer(address(msg.sender), factoredBalance);
        emit EmergencyWithdraw(msg.sender, _pid, factoredBalance);
    }

    // -------- For manage pool ---------
    function add(uint256 _allocPoint, IERC20 _lpToken) internal {
        require(poolId1[address(_lpToken)] == 0, "HATMaster::add: lp is already in pool");
        uint256 lastRewardBlock = block.number > START_BLOCK ? block.number : START_BLOCK;

        poolId1[address(_lpToken)] = poolInfo.length + 1;

        poolInfo.push(PoolInfo({
            lpToken: _lpToken,
            allocPoint: _allocPoint,
            lastRewardBlock: lastRewardBlock,
            rewardPerShare: 0,
            totalUsersAmount: 0,
            lastProcessedTotalAllocPoint: 0
        }));

        uint256 totalAllocPoint = (globalPoolUpdates.length == 0) ? _allocPoint :
        globalPoolUpdates[globalPoolUpdates.length-1].totalAllocPoint.add(_allocPoint);

        if (totalAllocPointUpdatedAtBlock[block.number] != 0) {
           //already update in this block
            globalPoolUpdates[totalAllocPointUpdatedAtBlock[block.number]-1].totalAllocPoint = totalAllocPoint;
        } else {
            globalPoolUpdates.push(PoolUpdate({
                blockNumber: block.number,
                totalAllocPoint: totalAllocPoint
            }));
            totalAllocPointUpdatedAtBlock[block.number] = globalPoolUpdates.length;
        }
    }

    function set(uint256 _pid, uint256 _allocPoint) internal {
        updatePool(_pid);
        uint256 totalAllocPoint =
        globalPoolUpdates[globalPoolUpdates.length-1].totalAllocPoint
        .sub(poolInfo[_pid].allocPoint).add(_allocPoint);

        if (totalAllocPointUpdatedAtBlock[block.number] != 0) {
           //already update in this block
            globalPoolUpdates[totalAllocPointUpdatedAtBlock[block.number]-1].totalAllocPoint = totalAllocPoint;
        } else {
            globalPoolUpdates.push(PoolUpdate({
                blockNumber: block.number,
                totalAllocPoint: totalAllocPoint
            }));
            totalAllocPointUpdatedAtBlock[block.number] = globalPoolUpdates.length;
        }
        poolInfo[_pid].allocPoint = _allocPoint;
    }

    // -----------------------------
    function safeTransferReward(address _to, uint256 _amount, uint256 _pid) internal {
        uint256 bal = HAT.balanceOf(address(this));
        if (_amount > bal) {
            HAT.transfer(_to, bal);
            emit SendReward(_to, _pid, bal, _amount);
        } else {
            HAT.transfer(_to, _amount);
            emit SendReward(_to, _pid, _amount, _amount);
        }
    }
}
