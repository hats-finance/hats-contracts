// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.6;


import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/utils/SafeERC20.sol";
import "openzeppelin-solidity/contracts/utils/math/SafeMath.sol";
import "./HATToken.sol";
import "openzeppelin-solidity/contracts/security/ReentrancyGuard.sol";
import "./Governable.sol";


// Errors:
// HME01: Pool range is too big
// HME02: Invalid pool range
// HME03: Committee not checked in yet
// HME04: Withdraw: not enough user balance
// HME05: User shares must be greater than 0
contract HATMaster is Governable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

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

    struct RewardsSplit {
        //the percentage of the total reward to reward the hacker via vesting contract(claim reported)
        uint256 hackerVestedReward;
        //the percentage of the total reward to reward the hacker(claim reported)
        uint256 hackerReward;
        // the percentage of the total reward to be sent to the committee
        uint256 committeeReward;
        // the percentage of the total reward to be swap to HAT and to be burned
        uint256 swapAndBurn;
        // the percentage of the total reward to be swap to HAT and sent to governance
        uint256 governanceHatReward;
        // the percentage of the total reward to be swap to HAT and sent to the hacker
        uint256 hackerHatReward;
    }

    // Info of each pool.
    struct PoolInfo {
        IERC20 lpToken;
        uint256 allocPoint;
        uint256 lastRewardBlock;
        uint256 rewardPerShare;
        uint256 totalShares;
        //index of last PoolUpdate in globalPoolUpdates (number of times we have updated the total allocation points - 1)
        uint256 lastProcessedTotalAllocPoint;
        uint256 balance;
        uint256 fee;
    }

    // Info of each pool.
    struct PoolReward {
        RewardsSplit rewardsSplit;
        uint256[]  rewardsLevels;
        bool committeeCheckIn;
        uint256 vestingDuration;
        uint256 vestingPeriods;
    }

    HATToken public immutable HAT;
    uint256 public immutable REWARD_PER_BLOCK;
    uint256 public immutable START_BLOCK;
    uint256 public immutable MULTIPLIER_PERIOD;
    uint256 public constant MULTIPLIERS_LENGTH = 24;
    uint256 public constant HUNDRED_PERCENT = 10000;
    uint256 public constant MAX_FEE = 200; // Max fee is 2%

    // Info of each pool.
    PoolInfo[] public poolInfo;
    PoolUpdate[] public globalPoolUpdates;

    // Reward Multipliers
    uint256[24] public rewardMultipliers = [4413, 4413, 8825, 7788, 6873, 6065,
                                            5353, 4724, 4169, 3679, 3247, 2865,
                                            2528, 2231, 1969, 1738, 1534, 1353,
                                            1194, 1054, 930, 821, 724, 639];

    // Info of each user that stakes LP tokens. pid => user address => info
    mapping (uint256 => mapping (address => UserInfo)) public userInfo;
    //pid -> PoolReward
    mapping (uint256=>PoolReward) internal poolsRewards;

    uint256 public rewardAvailable;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event SendReward(address indexed user, uint256 indexed pid, uint256 amount, uint256 requestedAmount);
    event MassUpdatePools(uint256 _fromPid, uint256 _toPid);

    constructor(
        HATToken _hat,
        uint256 _rewardPerBlock,
        uint256 _startBlock,
        uint256 _multiplierPeriod
    // solhint-disable-next-line func-visibility
    ) {
        HAT = _hat;
        REWARD_PER_BLOCK = _rewardPerBlock;
        START_BLOCK = _startBlock;
        MULTIPLIER_PERIOD = _multiplierPeriod;
    }

    function depositHATReward(uint256 _amount) external {
        rewardAvailable += _amount;
        HAT.transferFrom(address(msg.sender), address(this), _amount);
    }
    
  /**
   * @dev massUpdatePools - Update reward variables for all pools
   * Be careful of gas spending!
   * @param _fromPid update pools range from this pool id
   * @param _toPid update pools range to this pool id
   */
    function massUpdatePools(uint256 _fromPid, uint256 _toPid) external {
        require(_toPid <= poolInfo.length, "HME01");
        require(_fromPid <= _toPid, "HME02");
        for (uint256 pid = _fromPid; pid < _toPid; ++pid) {
            updatePool(pid);
        }
        emit MassUpdatePools(_fromPid, _toPid);
    }

    /**
     * @notice Transfer the sender their pending share of HATs rewards.
     * @param _pid The pool id
     */
    function claimReward(uint256 _pid) external {
        _deposit(_pid, 0);
    }

    /**
     * @dev Update the pool's rewardPerShare, not more then once per block
     * @param _pid The pool id
     */
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        uint256 lastRewardBlock = pool.lastRewardBlock;
        if (block.number <= lastRewardBlock) {
            return;
        }
        uint256 totalShares = pool.totalShares;
        uint256 lastPoolUpdate = globalPoolUpdates.length-1;
        if (totalShares == 0) {
            pool.lastRewardBlock = block.number;
            pool.lastProcessedTotalAllocPoint = lastPoolUpdate;
            return;
         }
        uint256 reward = calcPoolReward(_pid, lastRewardBlock, lastPoolUpdate);
        pool.rewardPerShare = pool.rewardPerShare.add(reward.mul(1e12).div(totalShares));
        pool.lastRewardBlock = block.number;
        pool.lastProcessedTotalAllocPoint = lastPoolUpdate;
    }

    /**
     * @dev getMultiplier - multiply blocks with relevant multiplier for specific range
     * @param _fromBlock range's from block
     * @param _toBlock range's to block
     * will revert if from < START_BLOCK or _toBlock < _fromBlock
     */
    function getMultiplier(uint256 _fromBlock, uint256 _toBlock) public view returns (uint256 result) {
        uint256 i = (_fromBlock - START_BLOCK) / MULTIPLIER_PERIOD + 1;
        for (; i <= MULTIPLIERS_LENGTH; i++) {
            uint256 endBlock = MULTIPLIER_PERIOD * i + START_BLOCK;
            if (_toBlock <= endBlock) {
                break;
            }
            result += (endBlock - _fromBlock) * rewardMultipliers[i-1];
            _fromBlock = endBlock;
        }
        result += (_toBlock - _fromBlock) * (i > MULTIPLIERS_LENGTH ? 0 : rewardMultipliers[i-1]);
    }

    function getRewardForBlocksRange(uint256 _fromBlock, uint256 _toBlock, uint256 _allocPoint, uint256 _totalAllocPoint)
    public
    view
    returns (uint256 reward) {
        if (_totalAllocPoint > 0) {
            reward = getMultiplier(_fromBlock, _toBlock).mul(REWARD_PER_BLOCK).mul(_allocPoint).div(_totalAllocPoint).div(100);
        }
    }

    /**
     * @dev Calculate rewards for a pool by iterating over the history of totalAllocPoints updates,
     * and sum up all rewards periods from pool.lastRewardBlock untill current block number.
     * @param _pid The pool id
     * @param _fromBlock The block from which to start calculation
     * @param _lastPoolUpdateIndex index of last PoolUpdate in globalPoolUpdates to calculate for
     * @return reward
     */
    function calcPoolReward(uint256 _pid, uint256 _fromBlock, uint256 _lastPoolUpdateIndex) public view returns(uint256 reward) {
        uint256 poolAllocPoint = poolInfo[_pid].allocPoint;
        uint256 i = poolInfo[_pid].lastProcessedTotalAllocPoint;
        for (; i < _lastPoolUpdateIndex; i++) {
            uint256 nextUpdateBlock = globalPoolUpdates[i+1].blockNumber;
            reward =
            reward.add(getRewardForBlocksRange(_fromBlock,
                                            nextUpdateBlock,
                                            poolAllocPoint,
                                            globalPoolUpdates[i].totalAllocPoint));
            _fromBlock = nextUpdateBlock;
        }
        return reward.add(getRewardForBlocksRange(_fromBlock,
                                                block.number,
                                                poolAllocPoint,
                                                globalPoolUpdates[i].totalAllocPoint));
    }

    function _deposit(uint256 _pid, uint256 _amount) internal nonReentrant {
        require(poolsRewards[_pid].committeeCheckIn, "HME03");
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        updatePool(_pid);
        if (user.shares > 0) {
            uint256 pending = user.shares.mul(pool.rewardPerShare).div(1e12).sub(user.rewardDebt);
            if (pending > 0) {
                safeTransferReward(msg.sender, pending, _pid);
            }
        }
        if (_amount > 0) {
            uint256 lpSupply = pool.balance;
            pool.lpToken.safeTransferFrom(address(msg.sender), address(this), _amount);
            pool.balance = pool.balance.add(_amount);
            uint256 factoredAmount = _amount;
            if (pool.totalShares > 0) {
                factoredAmount = pool.totalShares.mul(_amount).div(lpSupply);
            }
            user.shares = user.shares.add(factoredAmount);
            pool.totalShares = pool.totalShares.add(factoredAmount);
        }
        user.rewardDebt = user.shares.mul(pool.rewardPerShare).div(1e12);
        emit Deposit(msg.sender, _pid, _amount);
    }

    function _withdraw(uint256 _pid, uint256 _amount) internal nonReentrant {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.shares >= _amount, "HME04");

        updatePool(_pid);
        uint256 pending = user.shares.mul(pool.rewardPerShare).div(1e12).sub(user.rewardDebt);
        if (pending > 0) {
            safeTransferReward(msg.sender, pending, _pid);
        }
        if (_amount > 0) {
            user.shares = user.shares.sub(_amount);
            uint256 amountToWithdraw = _amount.mul(pool.balance).div(pool.totalShares);
            uint256 fee = amountToWithdraw * pool.fee / HUNDRED_PERCENT;
            pool.balance = pool.balance.sub(amountToWithdraw);
            if (fee > 0) {
                pool.lpToken.safeTransfer(governance(), fee);
            }
            pool.lpToken.safeTransfer(msg.sender, amountToWithdraw - fee);
            pool.totalShares = pool.totalShares.sub(_amount);
        }
        user.rewardDebt = user.shares.mul(pool.rewardPerShare).div(1e12);
        emit Withdraw(msg.sender, _pid, _amount);
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function _emergencyWithdraw(uint256 _pid) internal {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.shares > 0, "HME05");
        uint256 factoredBalance = user.shares.mul(pool.balance).div(pool.totalShares);
        pool.totalShares = pool.totalShares.sub(user.shares);
        user.shares = 0;
        user.rewardDebt = 0;
        uint256 fee = factoredBalance * pool.fee / HUNDRED_PERCENT;
        if (fee > 0) {
            pool.lpToken.safeTransfer(governance(), fee);
        }
        pool.balance = pool.balance.sub(factoredBalance);
        pool.lpToken.safeTransfer(msg.sender, factoredBalance - fee);
        emit EmergencyWithdraw(msg.sender, _pid, factoredBalance);
    }

    // -------- For manage pool ---------
    function _addPool(uint256 _allocPoint, IERC20 _lpToken) internal {
        uint256 lastRewardBlock = block.number > START_BLOCK ? block.number : START_BLOCK;
        uint256 totalAllocPoint = (globalPoolUpdates.length == 0) ? _allocPoint :
        globalPoolUpdates[globalPoolUpdates.length-1].totalAllocPoint.add(_allocPoint);

        if (globalPoolUpdates.length > 0 &&
            globalPoolUpdates[globalPoolUpdates.length-1].blockNumber == block.number) {
           //already update in this block
            globalPoolUpdates[globalPoolUpdates.length-1].totalAllocPoint = totalAllocPoint;
        } else {
            globalPoolUpdates.push(PoolUpdate({
                blockNumber: block.number,
                totalAllocPoint: totalAllocPoint
            }));
        }

        poolInfo.push(PoolInfo({
            lpToken: _lpToken,
            allocPoint: _allocPoint,
            lastRewardBlock: lastRewardBlock,
            rewardPerShare: 0,
            totalShares: 0,
            lastProcessedTotalAllocPoint: globalPoolUpdates.length-1,
            balance: 0,
            fee: 0
        }));
    }

    function set(uint256 _pid, uint256 _allocPoint) internal {
        updatePool(_pid);
        uint256 totalAllocPoint =
        globalPoolUpdates[globalPoolUpdates.length-1].totalAllocPoint
        .sub(poolInfo[_pid].allocPoint).add(_allocPoint);

        if (globalPoolUpdates[globalPoolUpdates.length-1].blockNumber == block.number) {
           //already update in this block
            globalPoolUpdates[globalPoolUpdates.length-1].totalAllocPoint = totalAllocPoint;
        } else {
            globalPoolUpdates.push(PoolUpdate({
                blockNumber: block.number,
                totalAllocPoint: totalAllocPoint
            }));
        }
        poolInfo[_pid].allocPoint = _allocPoint;
    }

    // Safe HAT transfer function,  transfer HATs from the contract only if they are earmarked for rewards
    function safeTransferReward(address _to, uint256 _amount, uint256 _pid) internal {
        if (_amount > rewardAvailable) { 
            _amount = rewardAvailable; 
        }
        rewardAvailable = rewardAvailable - _amount;
        HAT.transfer(_to, _amount);
        emit SendReward(_to, _pid, _amount, _amount);
    }
}
