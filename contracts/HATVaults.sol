// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.6;


import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./Governable.sol";
import "./HATToken.sol";
import "./tokenlock/ITokenLockFactory.sol";
import "./interfaces/ISwapRouter.sol";


// Errors:
// HVE01: Only committee
// HVE02: Claim submitted
// HVE03: Safety period
// HVE04: Beneficiary is zero
// HVE05: Not safety period
// HVE06: _severity is not in the range
// HVE07: Withdraw request pending period must be <= 3 months
// HVE08: Withdraw request enabled period must be >= 6 hour
// HVE09: Only callable by governance or after 5 weeks
// HVE10: No claim submitted
// HVE11: Amount to reward is too big
// HVE12: Withdraw period must be >= 1 hour
// HVE13: Safety period must be <= 6 hours
// HVE14: Not enough fee paid
// HVE15: Vesting duration is too long
// HVE16: Vesting periods cannot be zero
// HVE17: Vesting duration smaller than periods
// HVE18: Delay is too short
// HVE19: No pending set bounty levels
// HVE20: Delay period for setting bounty levels had not passed
// HVE21: Committee is zero
// HVE22: Committee already checked in
// HVE23: Pool does not exist
// HVE24: Amount is zero
// HVE25: Pending withdraw request exist
// HVE26: Deposit paused
// HVE27: Amount less than 1e6
// HVE28: totalSupply is zero
// HVE29: Total split % should be `HUNDRED_PERCENT`
// HVE30: Withdraw request is invalid
// HVE31: Token approve failed
// HVE32: Wrong amount received
// HVE33: Bounty level can not be more than `HUNDRED_PERCENT`
// HVE34: LP token is zero
// HVE35: Only fee setter
// HVE36: Fee must be less than or eqaul to 2%
// HVE37: Token approve reset failed
// HVE38: Pool range is too big
// HVE39: Invalid pool range
// HVE40: Committee not checked in yet
// HVE41: Not enough user balance
// HVE42: User shares must be greater than 0

/// @title Manage all Hats.finance vaults
contract  HATVaults is Governable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    //Parameters that apply to all the vaults
    struct GeneralParameters {
        uint256 hatVestingDuration;
        uint256 hatVestingPeriods;
        //withdraw enable period. safetyPeriod starts when finished.
        uint256 withdrawPeriod;
        //withdraw disable period - time for the commitee to gather and decide on actions, withdrawals are not possible in this time
        //withdrawPeriod starts when finished.
        uint256 safetyPeriod;
        uint256 setBountyLevelsDelay;
        // period of time after withdrawRequestPendingPeriod where it is possible to withdraw
        // (after which withdrawal is not possible)
        uint256 withdrawRequestEnablePeriod;
        // period of time that has to pass after withdraw request until withdraw is possible
        uint256 withdrawRequestPendingPeriod;
        uint256 claimFee;  //claim fee in ETH
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

    // Info of each pool.
    struct PoolInfo {
        IERC20 lpToken;
        uint256 allocPoint;
        uint256 lastRewardBlock;
        uint256 rewardPerShare;
        uint256 totalShares;
        // index of last PoolUpdate in globalPoolUpdates (number of times we have updated the total allocation points - 1)
        uint256 lastProcessedTotalAllocPoint;
        // total amount of LP tokens in pool
        uint256 balance;
        // fee to take from withdrawals to governance
        uint256 withdrawalFee;
    }

    // Info of each pool's bounty policy.
    struct BountyInfo {
        BountySplit bountySplit;
        uint256[] bountyLevels;
        bool committeeCheckIn;
        uint256 vestingDuration;
        uint256 vestingPeriods;
    }
    
    // How to devide the bounties for each pool, in percentages (out of `HUNDRED_PERCENT`)
    struct BountySplit {
        //the percentage of the total bounty to reward the hacker via vesting contract
        uint256 hackerVested;
        //the percentage of the total bounty to reward the hacker
        uint256 hacker;
        // the percentage of the total bounty to be sent to the committee
        uint256 committee;
        // the percentage of the total bounty to be swapped to HATs and then burned
        uint256 swapAndBurn;
        // the percentage of the total bounty to be swapped to HATs and sent to governance
        uint256 governanceHat;
        // the percentage of the total bounty to be swapped to HATs and sent to the hacker
        uint256 hackerHat;
    }

    // How to devide a bounty for a claim that has been approved, in amounts of pool's tokens
    struct ClaimBounty {
        uint256 hackerVested;
        uint256 hacker;
        uint256 committee;
        uint256 swapAndBurn;
        uint256 governanceHat;
        uint256 hackerHat;
    }
    
    // Info of a claim that has been submitted by a committe 
    struct SubmittedClaim {
        address beneficiary;
        uint256 severity;
        // the address of the committee at the time of the submittal, so that this committee 
        // will be payed their share of the bounty in case the committee changes before claim approval
        address committee;
        uint256 createdAt;
    }

    struct PendingBountyLevels {
        uint256 timestamp;
        uint256[] bountyLevels;
    }


    HATToken public immutable HAT;
    uint256 public immutable REWARD_PER_BLOCK;
    // Block from which the HAT vault contract will start rewarding.
    uint256 public immutable START_BLOCK; 
    uint256 public immutable MULTIPLIER_PERIOD;
    uint256 public constant MULTIPLIERS_LENGTH = 24;
    uint256 public constant HUNDRED_PERCENT = 10000;
    uint256 public constant MAX_FEE = 200; // Max fee is 2%

    // Info of each pool.
    PoolInfo[] public poolInfos;
    PoolUpdate[] public globalPoolUpdates;

    // Reward Multipliers
    uint256[24] public rewardMultipliers = [4413, 4413, 8825, 7788, 6873, 6065,
                                            5353, 4724, 4169, 3679, 3247, 2865,
                                            2528, 2231, 1969, 1738, 1534, 1353,
                                            1194, 1054, 930, 821, 724, 639];

    // Info of each user that stakes LP tokens. pid => user address => info
    mapping (uint256 => mapping (address => UserInfo)) public userInfo;
    //pid -> BountyInfo
    mapping (uint256=>BountyInfo) internal bountyInfos;

    uint256 public hatRewardAvailable;

    //pid -> committee address
    mapping(uint256=>address) public committees;
    //pid -> amount
    mapping(uint256 => uint256) public swapAndBurns;
    //hackerAddress ->(pid->amount)
    mapping(address => mapping(uint256 => uint256)) public hackersHatRewards;
    //pid -> amount
    mapping(uint256 => uint256) public governanceHatRewards;
    //pid -> SubmittedClaim
    mapping(uint256 => SubmittedClaim) public submittedClaims;
    //poolId -> (address -> requestTime)
    // Time of when last withdraw request pending period ended, or 0 if last action was deposit or withdraw
    mapping(uint256 => mapping(address => uint256)) public withdrawEnableStartTime;
    //poolId -> PendingBountyLevels
    mapping(uint256 => PendingBountyLevels) public pendingBountyLevels;

    mapping(uint256 => bool) public poolDepositPause;

    GeneralParameters public generalParameters;

    address public feeSetter;

    ITokenLockFactory public immutable tokenLockFactory;
    ISwapRouter public immutable uniSwapRouter;
    uint256 public constant MINIMUM_DEPOSIT = 1e6;

    modifier onlyCommittee(uint256 _pid) {
        require(committees[_pid] == msg.sender, "HVE01");
        _;
    }

    modifier noSubmittedClaims(uint256 _pid) {
        require(submittedClaims[_pid].beneficiary == address(0), "HVE02");
        _;
    }

    modifier noSafetyPeriod() {
      //disable withdraw for safetyPeriod (e.g 1 hour) after each withdrawPeriod(e.g 11 hours)
      // solhint-disable-next-line not-rely-on-time
        require(block.timestamp % (generalParameters.withdrawPeriod + generalParameters.safetyPeriod) <
        generalParameters.withdrawPeriod,
        "HVE03");
        _;
    }

    modifier onlyFeeSetter() {
        require(feeSetter == msg.sender || (governance() == msg.sender && feeSetter == address(0)), "HVE35");
        _;
    }


    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 shares);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event SafeTransferReward(address indexed user, uint256 indexed pid, uint256 amount, uint256 requestedAmount);
    event MassUpdatePools(uint256 _fromPid, uint256 _toPid);

    event SetCommittee(uint256 indexed _pid, address indexed _committee);
    event CommitteeCheckedIn(uint256 indexed _pid);

    event AddPool(uint256 indexed _pid,
                uint256 indexed _allocPoint,
                address indexed _lpToken,
                address _committee,
                string _descriptionHash,
                uint256[] _bountyLevels,
                BountySplit _bountySplit,
                uint256 _bountyVestingDuration,
                uint256 _bountyVestingPeriods);

    event SetPool(uint256 indexed _pid, uint256 indexed _allocPoint, bool indexed _registered, bool _depositPause, string _descriptionHash);
    event Claim(address indexed _claimer, string _descriptionHash);
    event SetBountySplit(uint256 indexed _pid, BountySplit _bountySplit);
    event SetBountyLevels(uint256 indexed _pid, uint256[] _bountyLevels);
    event SetFeeSetter(address indexed _newFeeSetter);
    event SetPoolWithdrawalFee(uint256 indexed _pid, uint256 _newFee);
    event SetPendingBountyLevels(uint256 indexed _pid, uint256[] _bountyLevels, uint256 _timeStamp);

    event SwapAndSend(uint256 indexed _pid,
                    address indexed _beneficiary,
                    uint256 indexed _amountSwapped,
                    uint256 _amountReceived,
                    address _tokenLock);

    event SwapAndBurn(uint256 indexed _pid, uint256 indexed _amountSwapped, uint256 indexed _amountBurned);
    event SetVestingParams(uint256 indexed _pid, uint256 indexed _duration, uint256 indexed _periods);
    event SetHatVestingParams(uint256 indexed _duration, uint256 indexed _periods);

    event ApproveClaim(uint256 indexed _pid,
                    address indexed _committee,
                    address indexed _beneficiary,
                    uint256 _severity,
                    address _tokenLock,
                    ClaimBounty _claimBounty);

    event SubmitClaim(uint256 indexed _pid,
                            address _committee,
                            address indexed _beneficiary,
                            uint256 indexed _severity);

    event WithdrawRequest(uint256 indexed _pid,
                        address indexed _beneficiary,
                        uint256 indexed _withdrawEnableTime);

    event SetWithdrawSafetyPeriod(uint256 indexed _withdrawPeriod, uint256 indexed _safetyPeriod);
    event SetRewardMultipliers(uint256[24] _rewardMultipliers);
    event SetClaimFee(uint256 _fee);
    event RewardDepositors(uint256 indexed _pid, uint256 indexed _amount);
    event DepositHATReward(uint256 indexed _amount);
    event ClaimReward(uint256 indexed _pid);
    event SetWithdrawRequestParams(uint256 indexed _withdrawRequestPendingPeriod, uint256 indexed _withdrawRequestEnablePeriod);
    event DismissClaim(uint256 indexed _pid);
    event SetBountyLevelsDelay(uint256 indexed _delay);

   /**
   * @dev constructor -
   * @param _rewardsToken The reward token address (HAT)
   * @param _rewardPerBlock The reward amount per block that the contract will reward pools
   * @param _startRewardingBlock Start block from which the contract will start rewarding
   * @param _multiplierPeriod A fixed period value. Each period will have its own multiplier value,
   *        which sets the reward for each period. e.g a value of 100000 means that each such period is 100000 blocks.
   * @param _hatGovernance The governance address.
   *        Some of the contracts functions are limited only to governance:
   *         addPool, setPool, dismissClaim, approveClaim,
   *         setHatVestingParams, setVestingParams, setBountySplit
   * @param _uniSwapRouter uni swap v3 router to be used to swap tokens for HAT token.
   * @param _tokenLockFactory Address of the token lock factory to be used
   *        to create a vesting contract for the approved claim reporter.
   */
    constructor(
        address _rewardsToken,
        uint256 _rewardPerBlock,
        uint256 _startRewardingBlock,
        uint256 _multiplierPeriod,
        address _hatGovernance,
        ISwapRouter _uniSwapRouter,
        ITokenLockFactory _tokenLockFactory
    // solhint-disable-next-line func-visibility
    ) {
        HAT = HATToken(_rewardsToken);
        REWARD_PER_BLOCK = _rewardPerBlock;
        START_BLOCK = _startRewardingBlock;
        MULTIPLIER_PERIOD = _multiplierPeriod;

        Governable.initialize(_hatGovernance);
        uniSwapRouter = _uniSwapRouter;
        tokenLockFactory = _tokenLockFactory;
        generalParameters = GeneralParameters({
            hatVestingDuration: 90 days,
            hatVestingPeriods:90,
            withdrawPeriod: 11 hours,
            safetyPeriod: 1 hours,
            setBountyLevelsDelay: 2 days,
            withdrawRequestEnablePeriod: 7 days,
            withdrawRequestPendingPeriod: 7 days,
            claimFee: 0
        });
    }



    function depositHATReward(uint256 _amount) external {
        hatRewardAvailable += _amount;
        HAT.transferFrom(address(msg.sender), address(this), _amount);
        emit DepositHATReward(_amount);

    }
    
  /**
   * @dev massUpdatePools - Update reward variables for all pools
   * Be careful of gas spending!
   * @param _fromPid update pools range from this pool id
   * @param _toPid update pools range to this pool id
   */
    function massUpdatePools(uint256 _fromPid, uint256 _toPid) external {
        require(_toPid <= poolInfos.length, "HVE38");
        require(_fromPid <= _toPid, "HVE39");
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
        emit ClaimReward(_pid);
    }

    /**
     * @dev Update the pool's rewardPerShare, not more then once per block
     * @param _pid The pool id
     */
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfos[_pid];
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
        pool.rewardPerShare = pool.rewardPerShare + (reward * 1e12 / totalShares);
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
            reward = getMultiplier(_fromBlock, _toBlock) * REWARD_PER_BLOCK * _allocPoint / _totalAllocPoint / 100;
        }
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
        uint256 poolAllocPoint = poolInfos[_pid].allocPoint;
        uint256 i = poolInfos[_pid].lastProcessedTotalAllocPoint;
        for (; i < _lastPoolUpdateIndex; i++) {
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

    function _deposit(uint256 _pid, uint256 _amount) internal nonReentrant {
        require(bountyInfos[_pid].committeeCheckIn, "HVE40");
        PoolInfo storage pool = poolInfos[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        updatePool(_pid);
        // if the user already has funds in the pool, give the previous reward
        if (user.shares > 0) {
            uint256 pending = user.shares * pool.rewardPerShare / 1e12 - user.rewardDebt;
            if (pending > 0) {
                safeTransferReward(msg.sender, pending, _pid);
            }
        }
        if (_amount > 0) { // will only be 0 in case of claimReward
            uint256 lpSupply = pool.balance;
            pool.lpToken.safeTransferFrom(address(msg.sender), address(this), _amount);
            pool.balance += _amount;
            uint256 userShares = _amount;
            // create new shares (and add to the user and the pool's shares) that are the relative part of the user's new deposit
            // out of the pool's total supply, relative to the previous total shares in the pool
            if (pool.totalShares > 0) {
                userShares = pool.totalShares * _amount / lpSupply;
            }
            user.shares += userShares;
            pool.totalShares += userShares;
        }
        user.rewardDebt = user.shares * pool.rewardPerShare / 1e12;
    }        


    // Safe HAT transfer function, transfer HATs from the contract only if they are earmarked for rewards
    function safeTransferReward(address _to, uint256 _amount, uint256 _pid) internal {
        if (_amount > hatRewardAvailable) { 
            _amount = hatRewardAvailable; 
        }
        hatRewardAvailable = hatRewardAvailable - _amount;
        HAT.transfer(_to, _amount);
        emit SafeTransferReward(_to, _pid, _amount, _amount);
    }


    /**
    * @notice Called by a committee to submit a claim for a bounty.
    * The submitted claim needs to be approved or dismissed by the Hats governance.
    * This function should be called only on a safety period, where withdrawals are disabled.
    * Upon a call to this function by the committee the pool withdrawals will be disabled
    * until the Hats governance will approve or dismiss this claim.
    * @param _pid The pool id
    * @param _beneficiary The submitted claim's beneficiary
    * @param _severity The submitted claim's bug severity
    */
    function submitClaim(uint256 _pid, address _beneficiary, uint256 _severity)
    external
    onlyCommittee(_pid)
    noSubmittedClaims(_pid) {
        require(_beneficiary != address(0), "HVE04");
        // require we are in safetyPeriod
        // solhint-disable-next-line not-rely-on-time
        require(block.timestamp % (generalParameters.withdrawPeriod + generalParameters.safetyPeriod) >=
        generalParameters.withdrawPeriod, "HVE05");
        require(_severity < bountyInfos[_pid].bountyLevels.length, "HVE06");

        submittedClaims[_pid] = SubmittedClaim({
            beneficiary: _beneficiary,
            severity: _severity,
            committee: msg.sender,
            // solhint-disable-next-line not-rely-on-time
            createdAt: block.timestamp
        });
        emit SubmitClaim(_pid, msg.sender, _beneficiary, _severity);
    }

    /**
     * @dev setWithdrawRequestParams - called by hats governance to set withdraw request params
     * @param _withdrawRequestPendingPeriod - the time period where the withdraw request is pending.
     * @param _withdrawRequestEnablePeriod - the time period where the withdraw is enable for a withdraw request.
    */
    function setWithdrawRequestParams(uint256 _withdrawRequestPendingPeriod, uint256  _withdrawRequestEnablePeriod)
    external
    onlyGovernance {
        require(90 days >= _withdrawRequestPendingPeriod, "HVE07");
        require(6 hours <= _withdrawRequestEnablePeriod, "HVE08");
        generalParameters.withdrawRequestPendingPeriod = _withdrawRequestPendingPeriod;
        generalParameters.withdrawRequestEnablePeriod = _withdrawRequestEnablePeriod;
        emit SetWithdrawRequestParams(_withdrawRequestPendingPeriod, _withdrawRequestEnablePeriod);
    }

  /**
   * @notice Dismiss a claim for a bounty submitted by a committee.
   * Called either by Hats govenrance, or by anyone if the claim is over 5 weeks old.
   * @param _pid The pool id
  */
    function dismissClaim(uint256 _pid) external {
        // solhint-disable-next-line not-rely-on-time
        require(msg.sender == governance() || submittedClaims[_pid].createdAt + 5 weeks < block.timestamp, "HVE09");
        delete submittedClaims[_pid];
        emit DismissClaim(_pid);
    }
    
  /**
   * @notice Approve a claim for a bounty submitted by a committee, and transfer bounty to hacker and committe.
   * Called only by hats governance.
   * @param _pid The pool id
   */
    function approveClaim(uint256 _pid) external onlyGovernance nonReentrant {
        require(submittedClaims[_pid].beneficiary != address(0), "HVE10");
        BountyInfo storage bountyInfo = bountyInfos[_pid];
        SubmittedClaim memory submittedClaim = submittedClaims[_pid];
        delete submittedClaims[_pid];

        IERC20 lpToken = poolInfos[_pid].lpToken;
        ClaimBounty memory claimBounty = calcClaimBounty(_pid, submittedClaim.severity);
        poolInfos[_pid].balance -= claimBounty.hacker
                            + claimBounty.hackerVested
                            + claimBounty.committee
                            + claimBounty.swapAndBurn
                            + claimBounty.hackerHat
                            + claimBounty.governanceHat;
        address tokenLock;
        if (claimBounty.hackerVested > 0) {
        //hacker gets part of bounty to a vesting contract
            tokenLock = tokenLockFactory.createTokenLock(
            address(lpToken),
            0x000000000000000000000000000000000000dEaD, //this address as owner, so it can do nothing.
            submittedClaim.beneficiary,
            claimBounty.hackerVested,
            // solhint-disable-next-line not-rely-on-time
            block.timestamp, //start
            // solhint-disable-next-line not-rely-on-time
            block.timestamp + bountyInfo.vestingDuration, //end
            bountyInfo.vestingPeriods,
            0, //no release start
            0, //no cliff
            ITokenLock.Revocability.Disabled,
            false
            );
            lpToken.safeTransfer(tokenLock, claimBounty.hackerVested);
        }
        lpToken.safeTransfer(submittedClaim.beneficiary, claimBounty.hacker);
        lpToken.safeTransfer(submittedClaim.committee, claimBounty.committee);
        //storing the amount of token which can be swap and burned so it could be swapAndBurn in a seperate tx.
        swapAndBurns[_pid] += claimBounty.swapAndBurn;
        governanceHatRewards[_pid] += claimBounty.governanceHat;
        hackersHatRewards[submittedClaim.beneficiary][_pid] += claimBounty.hackerHat;

        emit ApproveClaim(_pid,
                        msg.sender,
                        submittedClaim.beneficiary,
                        submittedClaim.severity,
                        tokenLock,
                        claimBounty);
        assert(poolInfos[_pid].balance > 0);
    }

    /**
     * @dev rewardDepositors - add funds to pool to reward depositors.
     * The funds will be given to depositors pro rata upon withdraw
     * @param _pid pool id
     * @param _amount amount to add
    */
    function rewardDepositors(uint256 _pid, uint256 _amount) external {
        require((poolInfos[_pid].balance + _amount) / MINIMUM_DEPOSIT < poolInfos[_pid].totalShares,
        "HVE11");
        poolInfos[_pid].lpToken.safeTransferFrom(msg.sender, address(this), _amount);
        poolInfos[_pid].balance += _amount;
        emit RewardDepositors(_pid, _amount);
    }

    /**
     * @dev setRewardMultipliers - called by hats governance to set reward multipliers
     * @param _rewardMultipliers reward multipliers
    */
    function setRewardMultipliers(uint256[24] memory _rewardMultipliers) external onlyGovernance {
        rewardMultipliers = _rewardMultipliers;
        emit SetRewardMultipliers(_rewardMultipliers);
    }

    /**
     * @dev Called by hats governance to set fee for submitting a claim to any vault
     * @param _fee claim fee in ETH
    */
    function setClaimFee(uint256 _fee) external onlyGovernance {
        generalParameters.claimFee = _fee;
        emit SetClaimFee(_fee);
    }

    /**
     * @dev setWithdrawSafetyPeriod - called by hats governance to set Withdraw Period
     * @param _withdrawPeriod withdraw enable period
     * @param _safetyPeriod withdraw disable period
    */
    function setWithdrawSafetyPeriod(uint256 _withdrawPeriod, uint256 _safetyPeriod) external onlyGovernance {
        require(1 hours <= _withdrawPeriod, "HVE12");
        require(_safetyPeriod <= 6 hours, "HVE13");
        generalParameters.withdrawPeriod = _withdrawPeriod;
        generalParameters.safetyPeriod = _safetyPeriod;
        emit SetWithdrawSafetyPeriod(_withdrawPeriod, _safetyPeriod);
    }

    //_descriptionHash - a hash of an ipfs encrypted file which describe the claim.
    // this can be use later on by the claimer to prove her claim
    function claim(string memory _descriptionHash) external payable {
        if (generalParameters.claimFee > 0) {
            require(msg.value >= generalParameters.claimFee, "HVE14");
            // solhint-disable-next-line indent
            payable(governance()).transfer(msg.value);
        }
        emit Claim(msg.sender, _descriptionHash);
    }

    /**
    * @dev setVestingParams - set pool vesting params for rewarding claim reporter with the pool token
    * @param _pid pool id
    * @param _duration duration of the vesting period
    * @param _periods the vesting periods
    */
    function setVestingParams(uint256 _pid, uint256 _duration, uint256 _periods) external onlyGovernance {
        require(_duration < 120 days, "HVE15");
        require(_periods > 0, "HVE16");
        require(_duration >= _periods, "HVE17");
        bountyInfos[_pid].vestingDuration = _duration;
        bountyInfos[_pid].vestingPeriods = _periods;
        emit SetVestingParams(_pid, _duration, _periods);
    }

    /**
   * @dev setHatVestingParams - set HAT vesting params for rewarding claim reporters with HAT token, for all pools
   * the function can be called only by governance.
   * @param _duration duration of the vesting period
   * @param _periods the vesting periods
 */
    function setHatVestingParams(uint256 _duration, uint256 _periods) external onlyGovernance {
        require(_duration < 180 days, "HVE15");
        require(_periods > 0, "HVE16");
        require(_duration >= _periods, "HVE17");
        generalParameters.hatVestingDuration = _duration;
        generalParameters.hatVestingPeriods = _periods;
        emit SetHatVestingParams(_duration, _periods);
    }

    /**
   * @dev Set the pool token bounty split upon an approval
   * The function can be called only by governance.
   * The sum of the parts of the bounty split should be less than `HUNDRED_PERCENT`
   * @param _pid The pool id
   * @param _bountySplit The bounty split
 */
    function setBountySplit(uint256 _pid, BountySplit memory _bountySplit)
    external
    onlyGovernance noSubmittedClaims(_pid) noSafetyPeriod {
        validateSplit(_bountySplit);
        bountyInfos[_pid].bountySplit = _bountySplit;
        emit SetBountySplit(_pid, _bountySplit);
    }

    /**
    * @dev Set the timelock delay for setting bounty levels (the time between setPendingBountyLevels and setBountyLevels)
    * @param _delay The delay time
    */
    function setBountyLevelsDelay(uint256 _delay)
    external
    onlyGovernance {
        require(_delay >= 2 days, "HVE18");
        generalParameters.setBountyLevelsDelay = _delay;
        emit SetBountyLevelsDelay(_delay);
    }

    /**
    * @dev Set pending request to set pool bounty levels.
    * The bounty level represents the percentage of the pool which will be given as a reward for a certain severity.
    * The function can be called only by the pool committee.
    * Cannot be called if there are claims that have been submitted.
    * Each level should be less than `HUNDRED_PERCENT`
    * @param _pid The pool id
    * @param _bountyLevels The array of bounty level per severity
    */
    function setPendingBountyLevels(uint256 _pid, uint256[] memory _bountyLevels)
    external
    onlyCommittee(_pid) noSubmittedClaims(_pid) {
        pendingBountyLevels[_pid].bountyLevels = checkBountyLevels(_bountyLevels);
        // solhint-disable-next-line not-rely-on-time
        pendingBountyLevels[_pid].timestamp = block.timestamp;
        emit SetPendingBountyLevels(_pid, _bountyLevels, pendingBountyLevels[_pid].timestamp);
    }

  /**
   * @dev Set the pool token bounty levels to the already pending bounty levels.
   * The bounty level represents the percentage of the pool which will be given as a bounty for a certain severity.
   * The function can be called only by the pool committee.
   * Cannot be called if there are claims that have been submitted.
   * Can only be called if there are bounty levels pending approval, and the time delay since setting the pending bounty 
   * levels had passed.
   * Each level should be less than `HUNDRED_PERCENT`
   * @param _pid The pool id
 */
    function setBountyLevels(uint256 _pid)
    external
    onlyCommittee(_pid) noSubmittedClaims(_pid) {
        require(pendingBountyLevels[_pid].timestamp > 0, "HVE19");
        // solhint-disable-next-line not-rely-on-time
        require(block.timestamp - pendingBountyLevels[_pid].timestamp > generalParameters.setBountyLevelsDelay, "HVE20");
        bountyInfos[_pid].bountyLevels = pendingBountyLevels[_pid].bountyLevels;
        delete pendingBountyLevels[_pid];
        emit SetBountyLevels(_pid, bountyInfos[_pid].bountyLevels);
    }

    /**
   * @dev committeeCheckIn - committee check in.
   * deposit is enable only after committee check in
   * @param _pid pool id
 */
    function committeeCheckIn(uint256 _pid) external onlyCommittee(_pid) {
        bountyInfos[_pid].committeeCheckIn = true;
        emit CommitteeCheckedIn(_pid);
    }


    /**
   * @dev setCommittee - set new committee address.
   * @param _pid pool id
   * @param _committee new committee address
 */
    function setCommittee(uint256 _pid, address _committee)
    external {
        require(_committee != address(0), "HVE21");
        //governance can update committee only if committee was not checked in yet.
        if (msg.sender == governance() && committees[_pid] != msg.sender) {
            require(!bountyInfos[_pid].committeeCheckIn, "HVE22");
        } else {
            require(committees[_pid] == msg.sender, "HVE01");
        }

        committees[_pid] = _committee;

        emit SetCommittee(_pid, _committee);
    }

    /**
   * @dev Add a new pool. Can be called only by governance.
   * @param _allocPoint The pool's allocation point
   * @param _lpToken The pool's token
   * @param _committee The pool's committee addres
   * @param _bountyLevels The pool's bounty levels.
     Each level is a number between 0 and `HUNDRED_PERCENT`, which represents the percentage of the pool to be rewarded for each severity.
   * @param _bountySplit The way to split the bounty between the hacker, committee and governance.
     Each entry is a number between 0 and `HUNDRED_PERCENT`.
     Total splits should be equal to `HUNDRED_PERCENT`.
     If no bounty is specified for the hacker (direct or vested in pool's token), the default bounty split will be used.
   * @param _descriptionHash the hash of the pool description.
   * @param _bountyVestingParams vesting params for the bounty
   *        _bountyVestingParams[0] - vesting duration
   *        _bountyVestingParams[1] - vesting periods
 */
    function addPool(uint256 _allocPoint,
                    address _lpToken,
                    address _committee,
                    uint256[] memory _bountyLevels,
                    BountySplit memory _bountySplit,
                    string memory _descriptionHash,
                    uint256[2] memory _bountyVestingParams)
    external
    onlyGovernance {
        require(_bountyVestingParams[0] < 120 days, "HVE15");
        require(_bountyVestingParams[1] > 0, "HVE16");
        require(_bountyVestingParams[0] >= _bountyVestingParams[1], "HVE17");
        require(_committee != address(0), "HVE21");
        require(_lpToken != address(0), "HVE34");
        
        uint256 lastRewardBlock = block.number > START_BLOCK ? block.number : START_BLOCK;
        uint256 totalAllocPoint = (globalPoolUpdates.length == 0) ? _allocPoint :
        globalPoolUpdates[globalPoolUpdates.length-1].totalAllocPoint + _allocPoint;
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
        poolInfos.push(PoolInfo({
            lpToken: IERC20(_lpToken),
            allocPoint: _allocPoint,
            lastRewardBlock: lastRewardBlock,
            rewardPerShare: 0,
            totalShares: 0,
            lastProcessedTotalAllocPoint: globalPoolUpdates.length-1,
            balance: 0,
            withdrawalFee: 0
        }));
   
        uint256 poolId = poolInfos.length-1;
        committees[poolId] = _committee;
        uint256[] memory bountyLevels = checkBountyLevels(_bountyLevels);
  
        BountySplit memory bountySplit = (_bountySplit.hackerVested == 0 && _bountySplit.hacker == 0) ?
        getDefaultBountySplit() : _bountySplit;
  
        validateSplit(bountySplit);
        bountyInfos[poolId] = BountyInfo({
            bountyLevels: bountyLevels,
            bountySplit: bountySplit,
            committeeCheckIn: false,
            vestingDuration: _bountyVestingParams[0],
            vestingPeriods: _bountyVestingParams[1]
        });

        emit AddPool(poolId,
            _allocPoint,
            _lpToken,
            _committee,
            _descriptionHash,
            bountyLevels,
            bountySplit,
            _bountyVestingParams[0],
            _bountyVestingParams[1]);
    } 

    /**
   * @dev setPool
   * @param _pid the pool id
   * @param _allocPoint the pool allocation point
   * @param _visible is this pool visible in the UI
   * @param _depositPause pause pool deposit (default false).
   * This parameter can be used by the UI to include or exclude the pool
   * @param _descriptionHash the hash of the pool description.
 */
    function setPool(uint256 _pid,
                    uint256 _allocPoint,
                    bool _visible,
                    bool _depositPause,
                    string memory _descriptionHash)
    external onlyGovernance {
        require(poolInfos.length > _pid, "HVE23");
        updatePool(_pid);
        uint256 totalAllocPoint =
        globalPoolUpdates[globalPoolUpdates.length-1].totalAllocPoint
        - poolInfos[_pid].allocPoint + _allocPoint;

        if (globalPoolUpdates[globalPoolUpdates.length-1].blockNumber == block.number) {
           //already updated in this block
            globalPoolUpdates[globalPoolUpdates.length-1].totalAllocPoint = totalAllocPoint;
        } else {
            globalPoolUpdates.push(PoolUpdate({
                blockNumber: block.number,
                totalAllocPoint: totalAllocPoint
            }));
        }
        poolInfos[_pid].allocPoint = _allocPoint;
        poolDepositPause[_pid] = _depositPause;
        emit SetPool(_pid, _allocPoint, _visible, _depositPause, _descriptionHash);
    }

    function setFeeSetter(address _newFeeSetter) external onlyGovernance {
        feeSetter = _newFeeSetter;
        emit SetFeeSetter(_newFeeSetter);
    }

    function setPoolWithdrawalFee(uint256 _pid, uint256 _newFee) external onlyFeeSetter {
        require(_newFee <= MAX_FEE, "HVE36");
        poolInfos[_pid].withdrawalFee = _newFee;
        emit SetPoolWithdrawalFee(_pid, _newFee);
    }

    /**
    * @dev Swap pool's token to HAT.
    * Send to beneficiary and governance their HATs rewards.
    * Burn the rest of HAT.
    * Only governance are authorized to call this function.
    * @param _pid the pool id
    * @param _beneficiary beneficiary
    * @param _amountOutMinimum minimum output of HATs at swap
    * @param _fees the fees for the multi path swap
    **/
    function swapBurnSend(uint256 _pid,
                        address _beneficiary,
                        uint256 _amountOutMinimum,
                        uint24[2] memory _fees)
    external
    onlyGovernance {
        IERC20 token = poolInfos[_pid].lpToken;
        uint256 amountToSwapAndBurn = swapAndBurns[_pid];
        uint256 amountForHackersHatRewards = hackersHatRewards[_beneficiary][_pid];
        uint256 amount = amountToSwapAndBurn + amountForHackersHatRewards + governanceHatRewards[_pid];
        require(amount > 0, "HVE24");
        swapAndBurns[_pid] = 0;
        governanceHatRewards[_pid] = 0;
        hackersHatRewards[_beneficiary][_pid] = 0;
        uint256 hatsReceived = swapTokenForHAT(amount, token, _fees, _amountOutMinimum);
        uint256 burntHats = hatsReceived * amountToSwapAndBurn / amount;
        if (burntHats > 0) {
            HAT.burn(burntHats);
        }
        emit SwapAndBurn(_pid, amount, burntHats);
        address tokenLock;
        uint256 hackerReward = hatsReceived * amountForHackersHatRewards / amount;
        if (hackerReward > 0) {
           //hacker get its reward via vesting contract
            tokenLock = tokenLockFactory.createTokenLock(
                address(HAT),
                0x000000000000000000000000000000000000dEaD, //this address as owner, so it can do nothing.
                _beneficiary,
                hackerReward,
                // solhint-disable-next-line not-rely-on-time
                block.timestamp, //start
                // solhint-disable-next-line not-rely-on-time
                block.timestamp + generalParameters.hatVestingDuration, //end
                generalParameters.hatVestingPeriods,
                0, //no release start
                0, //no cliff
                ITokenLock.Revocability.Disabled,
                true
            );
            HAT.transfer(tokenLock, hackerReward);
        }
        emit SwapAndSend(_pid, _beneficiary, amount, hackerReward, tokenLock);
        HAT.transfer(governance(), hatsReceived - hackerReward - burntHats);
    }

    /**
    * @notice Submit a request to withdraw funds from pool # `_pid`. 
    The request will only be approved if the last action was a deposit or withdrawal or in case the last action was a withdraw request,
    that the pending period (of `generalParameters.withdrawRequestPendingPeriod`) had ended and the withdraw enable period (of `generalParameters.withdrawRequestEnablePeriod`)
    had also ended.
    * @param _pid The pool ID
    **/
    function withdrawRequest(uint256 _pid) external {
        // require withdraw to be at least withdrawRequestEnablePeriod+withdrawRequestPendingPeriod since last withdrawwithdrawRequest
        // unless there's been a deposit or withdraw since, in which case withdrawRequest is allowed immediately
        // solhint-disable-next-line not-rely-on-time
        require(block.timestamp > withdrawEnableStartTime[_pid][msg.sender] + generalParameters.withdrawRequestEnablePeriod, "HVE25");
        // set the withdrawRequests time to be withdrawRequestPendingPeriod from now
        // solhint-disable-next-line not-rely-on-time
        withdrawEnableStartTime[_pid][msg.sender] = block.timestamp + generalParameters.withdrawRequestPendingPeriod;
        emit WithdrawRequest(_pid, msg.sender, withdrawEnableStartTime[_pid][msg.sender]);
    }

    /**
    * @notice Deposit tokens to pool
    * @param _pid The pool id
    * @param _amount Amount of pool's token to deposit. Must be at least `MINIMUM_DEPOSIT`
    **/
    function deposit(uint256 _pid, uint256 _amount) external {
        require(!poolDepositPause[_pid], "HVE26");
        require(_amount >= MINIMUM_DEPOSIT, "HVE27");
        //clear withdraw request
        withdrawEnableStartTime[_pid][msg.sender] = 0;
        _deposit(_pid, _amount);
        emit Deposit(msg.sender, _pid, _amount);
    }

    /**
    * @notice Withdraw user's requested share from the pool.
    * The withdrawal will only take place if the user has submitted a withdraw request, and the pending period of
    * `generalParameters.withdrawRequestPendingPeriod` had passed since then, and we are within the period where 
    * withdrawal is enabled, meaning `generalParameters.withdrawRequestEnablePeriod` had not passed since the pending period
    * had finished.
    * @param _pid The pool id
    * @param _shares Amount of shares user wants to withdraw
    **/
    function withdraw(uint256 _pid, uint256 _shares) external nonReentrant {
        checkWithdrawAndResetWithdrawEnableStartTime(_pid);
        PoolInfo storage pool = poolInfos[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.shares >= _shares, "HVE41");

        updatePool(_pid);
        uint256 pending = user.shares * pool.rewardPerShare / 1e12 - user.rewardDebt;
        if (pending > 0) {
            safeTransferReward(msg.sender, pending, _pid);
        }
        if (_shares > 0) {
            user.shares -= _shares;
            uint256 amountToWithdraw = _shares * pool.balance / pool.totalShares;
            uint256 fee = amountToWithdraw * pool.withdrawalFee / HUNDRED_PERCENT;
            pool.balance -= amountToWithdraw;
            if (fee > 0) {
                pool.lpToken.safeTransfer(governance(), fee);
            }
            pool.lpToken.safeTransfer(msg.sender, amountToWithdraw - fee);
            pool.totalShares -= _shares;
        }
        user.rewardDebt = user.shares * pool.rewardPerShare / 1e12;
        emit Withdraw(msg.sender, _pid, _shares);
    }

    /**
    * @notice Withdraw all user's pool share without claim for reward.
    * The withdrawal will only take place if the user has submitted a withdraw request, and the pending period of
    * `generalParameters.withdrawRequestPendingPeriod` had passed since then, and we are within the period where 
    * withdrawal is enabled, meaning `generalParameters.withdrawRequestEnablePeriod` had not passed since the pending period
    * had finished.   
    * @param _pid The pool id
    **/
    function emergencyWithdraw(uint256 _pid) external {
        checkWithdrawAndResetWithdrawEnableStartTime(_pid);
        PoolInfo storage pool = poolInfos[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.shares > 0, "HVE42");
        uint256 factoredBalance = user.shares * pool.balance / pool.totalShares;
        pool.totalShares -= user.shares;
        user.shares = 0;
        user.rewardDebt = 0;
        uint256 fee = factoredBalance * pool.withdrawalFee / HUNDRED_PERCENT;
        if (fee > 0) {
            pool.lpToken.safeTransfer(governance(), fee);
        }
        pool.balance -= factoredBalance;
        pool.lpToken.safeTransfer(msg.sender, factoredBalance - fee);
        emit EmergencyWithdraw(msg.sender, _pid, factoredBalance);
    }

    function getBountyLevels(uint256 _pid) external view returns(uint256[] memory) {
        return bountyInfos[_pid].bountyLevels;
    }

    function getBountyInfo(uint256 _pid) external view returns(BountyInfo memory) {
        return bountyInfos[_pid];
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

    function calcClaimBounty(uint256 _pid, uint256 _severity)
    public
    view
    returns(ClaimBounty memory claimBounty) {
        uint256 totalSupply = poolInfos[_pid].balance;
        require(totalSupply > 0, "HVE28");
        require(_severity < bountyInfos[_pid].bountyLevels.length, "HVE06");
        uint256 totalBountyAmount =
        totalSupply * bountyInfos[_pid].bountyLevels[_severity];
        claimBounty.hackerVested =
        totalBountyAmount * bountyInfos[_pid].bountySplit.hackerVested
        / (HUNDRED_PERCENT * HUNDRED_PERCENT);
        claimBounty.hacker =
        totalBountyAmount * bountyInfos[_pid].bountySplit.hacker
        / (HUNDRED_PERCENT * HUNDRED_PERCENT);
        claimBounty.committee =
        totalBountyAmount * bountyInfos[_pid].bountySplit.committee
        / (HUNDRED_PERCENT * HUNDRED_PERCENT);
        claimBounty.swapAndBurn =
        totalBountyAmount * bountyInfos[_pid].bountySplit.swapAndBurn
        / (HUNDRED_PERCENT * HUNDRED_PERCENT);
        claimBounty.governanceHat =
        totalBountyAmount * bountyInfos[_pid].bountySplit.governanceHat
        / (HUNDRED_PERCENT * HUNDRED_PERCENT);
        claimBounty.hackerHat =
        totalBountyAmount * bountyInfos[_pid].bountySplit.hackerHat
        / (HUNDRED_PERCENT * HUNDRED_PERCENT);
    }

    function getDefaultBountySplit() public pure returns (BountySplit memory) {
        return BountySplit({
            hackerVested: 6000,
            hacker: 2000,
            committee: 500,
            swapAndBurn: 0,
            governanceHat: 1000,
            hackerHat: 500
        });
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

    // Checks that the sender can perform a withdraw at this time
    // and also sets the withdrawRequest to 0
    function checkWithdrawAndResetWithdrawEnableStartTime(uint256 _pid) internal noSubmittedClaims(_pid) noSafetyPeriod {
        // check that withdrawRequestPendingPeriod had passed
        // solhint-disable-next-line not-rely-on-time
        require(block.timestamp > withdrawEnableStartTime[_pid][msg.sender] &&
        // check that withdrawRequestEnablePeriod had not passed and that the last action was withdrawRequests
        // (and not deposit or withdraw, which reset withdrawRequests[_pid][msg.sender] to 0)
        // solhint-disable-next-line not-rely-on-time
                block.timestamp < withdrawEnableStartTime[_pid][msg.sender] + generalParameters.withdrawRequestEnablePeriod,
                "HVE30");
        // if all is ok and withdrawal can be made - reset withdrawRequests[_pid][msg.sender] so that another withdrawRequest
        // will have to be made before next withdrawal 
        withdrawEnableStartTime[_pid][msg.sender] = 0;
    }

    function swapTokenForHAT(uint256 _amount,
                            IERC20 _token,
                            uint24[2] memory _fees,
                            uint256 _amountOutMinimum)
    internal
    returns (uint256 hatsReceived)
    {
        if (address(_token) == address(HAT)) {
            return _amount;
        }
        require(_token.approve(address(uniSwapRouter), _amount), "HVE31");
        uint256 hatBalanceBefore = HAT.balanceOf(address(this));
        address weth = uniSwapRouter.WETH9();
        bytes memory path;
        if (address(_token) == weth) {
            path = abi.encodePacked(address(_token), _fees[0], address(HAT));
        } else {
            path = abi.encodePacked(address(_token), _fees[0], weth, _fees[1], address(HAT));
        }
        hatsReceived = uniSwapRouter.exactInput(ISwapRouter.ExactInputParams({
            path: path,
            recipient: address(this),
            // solhint-disable-next-line not-rely-on-time
            deadline: block.timestamp,
            amountIn: _amount,
            amountOutMinimum: _amountOutMinimum
        }));
        require(HAT.balanceOf(address(this)) - hatBalanceBefore >= _amountOutMinimum, "HVE32");
        require(_token.approve(address(uniSwapRouter), 0), "HVE37");
    }

    /**
   * @dev Check bounty levels.
   * Each level should be less than `HUNDRED_PERCENT`
   * If _bountyLevels length is 0, default bounty levels will be returned ([2000, 4000, 6000, 8000]).
   * @param _bountyLevels The bounty levels array
   * @return bountyLevels
 */
    function checkBountyLevels(uint256[] memory _bountyLevels)
    private
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
}
