// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import "./interfaces/ISwapRouter.sol";
import "openzeppelin-solidity/contracts/token/ERC20/utils/SafeERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "./HATMaster.sol";
import "./tokenlock/ITokenLockFactory.sol";
import "./Governable.sol";


contract  HATVaults is Governable, HATMaster {
    using SafeMath  for uint256;
    using SafeERC20 for IERC20;

    struct PendingApproval {
        address beneficiary;
        uint256 severity;
        address approver;
    }

    struct ClaimReward {
        uint256 hackerVestedReward;
        uint256 hackerReward;
        uint256 committeeReward;
        uint256 swapAndBurn;
        uint256 governanceHatReward;
        uint256 hackerHatReward;
    }

    //pid -> committee address
    mapping (uint256=>address) public committees;
    mapping(address => uint256) public swapAndBurns;
    //hackerAddress ->(token->amount)
    mapping(address => mapping(address => uint256)) public hackersHatRewards;
    //token -> amount
    mapping(address => uint256) public governanceHatRewards;

    //pid -> PendingApproval
    mapping(uint256 => PendingApproval) public pendingApprovals;

    //poolId -> (address -> requestTime)
    mapping(uint256 => mapping(address => uint256)) public withdrawRequests;

    //claim fee in ETH
    uint256 public claimFee;

    uint256[] public defaultRewardLevel = [2000, 4000, 6000, 8000, 10000];
    uint256 internal constant REWARDS_LEVEL_DENOMINATOR = 10000;
    ITokenLockFactory public immutable tokenLockFactory;
    uint256 public hatVestingDuration = 90 days;
    uint256 public hatVestingPeriods = 90;
    uint256 public withdrawPeriod =  3000;
    uint256 public safetyPeriod =  240; //withdraw disable period
    ISwapRouter public immutable uniSwapRouter;
    uint256 public withdrawRequestEnablePeriod = 1 days;
    uint256 public withdrawRequestPendingPeriod = 7 days;

    modifier onlyCommittee(uint256 _pid) {
        require(committees[_pid] == msg.sender, "only committee");
        _;
    }

    modifier noPendingApproval(uint256 _pid) {
        require(pendingApprovals[_pid].beneficiary == address(0), "pending approval exist");
        _;
    }

    event SetCommittee(uint256 indexed _pid, address indexed _committee);

    event AddPool(uint256 indexed _pid,
                uint256 indexed _allocPoint,
                address indexed _lpToken,
                string _name,
                address _committee,
                string _descriptionHash,
                uint256[] _rewardsLevels,
                RewardsSplit _rewardsSplit,
                uint256 _rewardVestingDuration,
                uint256 _rewardVestingPeriods);

    event SetPool(uint256 indexed _pid, uint256 indexed _allocPoint, bool indexed _registered, string _descriptionHash);
    event Claim(address indexed _claimer, string _descriptionHash);
    event SetRewardsSplit(uint256 indexed _pid, RewardsSplit indexed _rewardsSplit);
    event SetRewardsLevels(uint256 indexed _pid, uint256[] indexed _rewardsLevels);

    event SwapAndSend(uint256 indexed _pid,
                    address indexed _beneficiary,
                    uint256 indexed _amountSwaped,
                    uint256 _amountReceived,
                    address _tokenLock);

    event SwapAndBurn(uint256 indexed _pid, uint256 indexed _amountSwaped, uint256 indexed _amountBurnet);
    event SetVestingParams(uint256 indexed _pid, uint256 indexed _duration, uint256 indexed _periods);
    event SetHatVestingParams(uint256 indexed _duration, uint256 indexed _periods);

    event ClaimApprove(address indexed _approver,
                    uint256 indexed _poolId,
                    address indexed _beneficiary,
                    uint256 _severity,
                    address _tokenLock,
                    ClaimReward _claimReward);

    event PendingApprovalLog(uint256 indexed _pid,
                            address indexed _beneficiary,
                            uint256 indexed _severity,
                            address _approver);

    event WithdrawRequest(uint256 indexed _pid,
                        address indexed _beneficiary,
                        uint256 indexed _withdrawEnableTime);

    event SetWithdrawSafetyPeriod(uint256 indexed _withdrawPeriod, uint256 indexed _safetyPeriod);

    /**
   * @dev constructor -
   * @param _rewardsToken the reward token address (HAT)
   * @param _rewardPerBlock the reward amount per block the contract will reward pools
   * @param _startBlock start block of of which the contract will start rewarding from.
   * @param _halvingAfterBlock a fix period value. each period will have its own multiplier value.
   *        which set the reward for each period. e.g a vaule of 100000 means that each such period is 100000 blocks.
   * @param _hatGovernance the governance address.
   *        Some of the contracts functions are limited only to governance :
   *         addPool,setPool,dismissPendingApprovalClaim,approveClaim,
   *         setHatVestingParams,setVestingParams,setRewardsSplit
   * @param _uniSwapRouter uni swap v3 router to be used to swap tokens for HAT token.
   * @param _tokenLockFactory address of the token lock factory to be used
   *        to create a vesting contract for the approved claim reporter.
 */
    constructor(
        address _rewardsToken,
        uint256 _rewardPerBlock,
        uint256 _startBlock,
        uint256 _halvingAfterBlock,
        address _hatGovernance,
        ISwapRouter _uniSwapRouter,
        ITokenLockFactory _tokenLockFactory
    // solhint-disable-next-line func-visibility
    ) HATMaster(HATToken(_rewardsToken), _rewardPerBlock, _startBlock, _halvingAfterBlock) {
        Governable.initialize(_hatGovernance);
        uniSwapRouter = _uniSwapRouter;
        tokenLockFactory = _tokenLockFactory;
    }

      /**
     * @dev pendingApprovalClaim - called by a commitee to set a pending approval claim.
     * The pending approval need to be approved or dismissd  by the hats governance.
     * This function should be called only on a safty period, where withdrawn is disable.
     * Upon a call to this function by the committee the pool withdrawn will be disable
     * till governance will approve or dismiss this pending approval.
     * @param _pid pool id
     * @param _beneficiary the approval claim beneficiary
     * @param _severity approval claim severity
   */
    function pendingApprovalClaim(uint256 _pid, address _beneficiary, uint256 _severity)
    external
    onlyCommittee(_pid)
    noPendingApproval(_pid) {
        require(_beneficiary != address(0), "beneficiary is zero");
        require(block.number % (withdrawPeriod + safetyPeriod) >= withdrawPeriod,
        "none safty period");
        require(_severity < poolsRewards[_pid].rewardsLevels.length, "_severity is not in the range");

        pendingApprovals[_pid] = PendingApproval({
            beneficiary: _beneficiary,
            severity: _severity,
            approver: msg.sender
        });
        emit PendingApprovalLog(_pid, _beneficiary, _severity, msg.sender);
    }

    /**
     * @dev setWithdrawRequestParams - called by hats governance to set withdraw request params
     * @param _withdrawRequestPendingPeriod - the time period where the withdraw request is pending.
     * @param _withdrawRequestEnablePeriod - the time period where the withdraw is enable for a withdraw request.
    */
    function setWithdrawRequestParams(uint256 _withdrawRequestPendingPeriod, uint256  _withdrawRequestEnablePeriod)
    external
    onlyGovernance {
        withdrawRequestPendingPeriod = _withdrawRequestPendingPeriod;
        withdrawRequestEnablePeriod = _withdrawRequestEnablePeriod;
    }

  /**
   * @dev dismissPendingApprovalClaim - called by hats governance to dismiss a pending approval claim.
   * @param _poolId pool id
  */
    function dismissPendingApprovalClaim(uint256 _poolId) external onlyGovernance {
        delete pendingApprovals[_poolId];
    }

    /**
   * @dev approveClaim - called by hats governance to approve a pending approval claim.
   * @param _poolId pool id
 */
    function approveClaim(uint256 _poolId) external onlyGovernance nonReentrant {
        require(pendingApprovals[_poolId].beneficiary != address(0), "no pending approval");
        PoolReward storage poolReward = poolsRewards[_poolId];
        PendingApproval memory pendingApproval = pendingApprovals[_poolId];
        delete pendingApprovals[_poolId];

        IERC20 lpToken = poolInfo[_poolId].lpToken;
        ClaimReward memory claimRewards = calcClaimRewards(_poolId, pendingApproval.severity);

        //hacker get its reward to a vesting contract
        address tokenLock = tokenLockFactory.createTokenLock(
            address(lpToken),
            governance(),
            pendingApproval.beneficiary,
            claimRewards.hackerVestedReward,
            // solhint-disable-next-line not-rely-on-time
            block.timestamp, //start
            // solhint-disable-next-line not-rely-on-time
            block.timestamp + poolReward.vestingDuration, //end
            poolReward.vestingPeriods,
            0, //no release start
            0, //no cliff
            ITokenLock.Revocability.Disabled,
            false
        );
        lpToken.safeTransfer(tokenLock, claimRewards.hackerVestedReward);
        lpToken.safeTransfer(pendingApproval.beneficiary, claimRewards.hackerReward);
        lpToken.safeTransfer(pendingApproval.approver, claimRewards.committeeReward);
        //storing the amount of token which can be swap and burned
        //so it could be swapAndBurn in a seperate tx.
        swapAndBurns[address(lpToken)] = swapAndBurns[address(lpToken)].add(claimRewards.swapAndBurn);
        governanceHatRewards[address(lpToken)] =
        governanceHatRewards[address(lpToken)].add(claimRewards.governanceHatReward);
        hackersHatRewards[pendingApproval.beneficiary][address(lpToken)] =
        hackersHatRewards[pendingApproval.beneficiary][address(lpToken)].add(claimRewards.hackerHatReward);
        poolReward.pendingLpTokenRewards =
        poolReward.pendingLpTokenRewards
        .add(claimRewards.swapAndBurn)
        .add(claimRewards.hackerHatReward)
        .add(claimRewards.governanceHatReward);

        emit ClaimApprove(msg.sender,
                        _poolId,
                        pendingApproval.beneficiary,
                        pendingApproval.severity,
                        tokenLock,
                        claimRewards);
        assert(lpToken.balanceOf(address(this)).sub(poolReward.pendingLpTokenRewards) > 0);
    }

    /**
     * @dev setClaimFee - called by hats governance to set claim fee
     * @param _fee claim fee in ETH
    */
    function setClaimFee(uint256 _fee) external onlyGovernance {
        claimFee = _fee;
    }

    /**
     * @dev setWithdrawSafetyPeriod - called by hats governance to set Withdraw Period
     * @param _withdrawPeriod withdraw enable period - in blocks unit
     * @param _safetyPeriod withdraw disable period - in blocks unit
    */
    function setWithdrawSafetyPeriod(uint256 _withdrawPeriod, uint256 _safetyPeriod) external onlyGovernance {
        withdrawPeriod = _withdrawPeriod;
        safetyPeriod = _safetyPeriod;
        emit SetWithdrawSafetyPeriod(withdrawPeriod, safetyPeriod);
    }

    //_descriptionHash - a hash of an ipfs encrypted file which describe the claim.
    // this can be use later on by the claimer to prove her claim
    function claim(string memory _descriptionHash) external payable {
        if (claimFee > 0) {
            require(msg.value >= claimFee, "not enough fee payed");
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
        require(_duration < 120 days, "vesting duration is too long");
        require(_periods > 0, "vesting periods cannot be zero");
        require(_duration >= _periods, "vesting duration smaller than periods");
        poolsRewards[_pid].vestingDuration = _duration;
        poolsRewards[_pid].vestingPeriods = _periods;
        emit SetVestingParams(_pid, _duration, _periods);
    }

    /**
   * @dev setHatVestingParams - set HAT vesting params for rewarding claim reporter with HAT token
   * the function can be called only by governance.
   * @param _duration duration of the vesting period
   * @param _periods the vesting periods
 */
    function setHatVestingParams(uint256 _duration, uint256 _periods) external onlyGovernance {
        require(_duration < 120 days, "vesting duration is too long");
        require(_periods > 0, "vesting periods cannot be zero");
        require(_duration >= _periods, "vesting duration smaller than periods");
        hatVestingDuration = _duration;
        hatVestingPeriods = _periods;
        emit SetHatVestingParams(_duration, _periods);
    }

    /**
   * @dev setRewardsSplit - set the pool token rewards split upon an approval
   * the function can be called only by governance.
   * the sum of the rewards split should be less than 10000 (less than 100%)
   * @param _pid pool id
   * @param _rewardsSplit split
   * and sent to the hacker(claim reported)
 */
    function setRewardsSplit(uint256 _pid, RewardsSplit memory _rewardsSplit)
    external
    onlyGovernance {
        validateSplit(_rewardsSplit);
        poolsRewards[_pid].rewardsSplit = _rewardsSplit;
        emit SetRewardsSplit(_pid, _rewardsSplit);
    }

    /**
   * @dev setRewardsLevels - set the pool token rewards level.
   * the reward level represent the percentage of the pool's token which will be splited as a reward.
   * the function can be called only by the pool committee.
   * cannot be called if there already pending approval.
   * each level should be less than 10000
   * @param _pid pool id
   * @param _rewardsLevels the reward levels array
 */
    function setRewardsLevels(uint256 _pid, uint256[] memory _rewardsLevels)
    external
    onlyCommittee(_pid) noPendingApproval(_pid) {
        for (uint256 i=0; i < _rewardsLevels.length; i++) {
            require(_rewardsLevels[i] <= REWARDS_LEVEL_DENOMINATOR, "reward level can't be more than 10000");
        }
        if (_rewardsLevels.length == 0) {
            poolsRewards[_pid].rewardsLevels = defaultRewardLevel;
        } else {
            poolsRewards[_pid].rewardsLevels = _rewardsLevels;
        }
        emit SetRewardsLevels(_pid, _rewardsLevels);
    }

    /**
   * @dev committeeCheckIn - committee check in.
   * deposit is enable only after committee check in
   * @param _pid pool id
 */
    function committeeCheckIn(uint256 _pid) external onlyCommittee(_pid) {
        poolsRewards[_pid].committeeCheckIn = true;
    }

    //use also for committee checkin.
    function setCommittee(uint256 _pid, address _committee)
    external {
        require(_committee != address(0), "commitee is zero");
        //governance can update committee only if commitee was not checked in yet.
        if (msg.sender == governance() && committees[_pid] != msg.sender) {
            require(!poolsRewards[_pid].committeeCheckIn, "Committee already checked in");
        } else {
            require(committees[_pid] == msg.sender, "Only committee");
        }

        committees[_pid] = _committee;

        emit SetCommittee(_pid, _committee);
    }

    /**
   * @dev addPool - onlyGovernance
   * @param _allocPoint the pool allocation point
   * @param _lpToken pool token
   * @param _committee pools committee addresses array
   * @param _rewardsLevels pool reward levels(sevirities)
     each level is a number between 0 and 10000.
   * @param _rewardsSplit pool reward split.
     each entry is a number between 0 and 10000.
     total splits should be less than 10000
   * @param _committee pools committee addresses array
   * @param _descriptionHash the hash of the pool description.
   * @param _rewardVestingParams vesting params
   *        _rewardVestingParams[0] - vesting duration
   *        _rewardVestingParams[1] - vesting periods
 */
    function addPool(uint256 _allocPoint,
                    address _lpToken,
                    address _committee,
                    uint256[] memory _rewardsLevels,
                    RewardsSplit memory _rewardsSplit,
                    string memory _descriptionHash,
                    uint256[2] memory _rewardVestingParams)
    external
    onlyGovernance {
        require(_rewardVestingParams[0] < 120 days, "vesting duration is too long");
        require(_rewardVestingParams[1] > 0, "vesting periods cannot be zero");
        require(_rewardVestingParams[0] >= _rewardVestingParams[1], "vesting duration smaller than periods");
        require(_committee != address(0), "committee is zero");
        add(_allocPoint, IERC20(_lpToken));
        uint256 poolId = poolInfo.length-1;
        committees[poolId] = _committee;
        uint256[] memory rewardsLevels = _rewardsLevels.length == 0 ? defaultRewardLevel : _rewardsLevels;

        RewardsSplit memory rewardsSplit = (_rewardsSplit.hackerVestedReward == 0 && _rewardsSplit.hackerReward == 0) ?
        getDefaultRewardsSplit() : _rewardsSplit;

        for (uint256 i=0; i < rewardsLevels.length; i++) {
            require(rewardsLevels[i] <= REWARDS_LEVEL_DENOMINATOR, "reward level can't be more than 10000");
        }
        validateSplit(_rewardsSplit);
        poolsRewards[poolId] = PoolReward({
            rewardsLevels: rewardsLevels,
            pendingLpTokenRewards: 0,
            rewardsSplit: rewardsSplit,
            committeeCheckIn: false,
            vestingDuration: _rewardVestingParams[0],
            vestingPeriods: _rewardVestingParams[1]
        });

        string memory name = ERC20(_lpToken).name();

        emit AddPool(poolId,
                    _allocPoint,
                    address(_lpToken),
                    name,
                    _committee,
                    _descriptionHash,
                    rewardsLevels,
                    rewardsSplit,
                    _rewardVestingParams[0],
                    _rewardVestingParams[1]);
    }

    /**
   * @dev setPool
   * @param _pid the pool id
   * @param _allocPoint the pool allocation point
   * @param _registered does this pool is registered (default true).
   * This parameter can be used by the UI to include or exclude the pool 
   * @param _descriptionHash the hash of the pool description.
 */
    function setPool(uint256 _pid,
                    uint256 _allocPoint,
                    bool _registered,
                    string memory _descriptionHash)
    external onlyGovernance {
        require(poolInfo[_pid].lpToken != IERC20(address(0)), "pool does not exist");
        set(_pid, _allocPoint);
        //set approver only if commite not checkin.
        emit SetPool(_pid, _allocPoint, _registered, _descriptionHash);
    }

    /**
    * swapBurnSend swap lptoken to HAT.
    * send to beneficiary and governance its hats rewards .
    * burn the rest of HAT.
    * only governance are authorized to call this function.
    * @param _pid the pool id
    * @param _beneficiary beneficiary
    * @param _minOutputAmount minimum output of HATs at swap
    * @param _fee the fee of the token pool for the pair
    * @param _sqrtPriceLimitX96 the price limit of the pool that cannot be exceeded by the swap
    **/
    function swapBurnSend(uint256 _pid,
                        address _beneficiary,
                        uint256 _minOutputAmount,
                        uint24 _fee,
                        uint160 _sqrtPriceLimitX96)
    external
    onlyGovernance {
        IERC20 token = poolInfo[_pid].lpToken;
        uint256 amountToSwapAndBurn = swapAndBurns[address(token)];
        uint256 amountForHackersHatRewards = hackersHatRewards[_beneficiary][address(token)];
        uint256 amount = amountToSwapAndBurn.add(amountForHackersHatRewards).add(governanceHatRewards[address(token)]);
        require(amount > 0, "amount is zero");
        swapAndBurns[address(token)] = 0;
        governanceHatRewards[address(token)] = 0;
        hackersHatRewards[_beneficiary][address(token)] = 0;
        uint256 hatsReceived = swapTokenForHAT(amount, token, _fee, _minOutputAmount, _sqrtPriceLimitX96);
        poolsRewards[_pid].pendingLpTokenRewards = poolsRewards[_pid].pendingLpTokenRewards.sub(amount);
        uint256 burntHats = hatsReceived.mul(amountToSwapAndBurn).div(amount);
        if (burntHats > 0) {
            HAT.burn(burntHats);
        }
        emit SwapAndBurn(_pid, amount, burntHats);
        address tokenLock;
        uint256 hackerReward = hatsReceived.mul(amountForHackersHatRewards).div(amount);
        if (hackerReward > 0) {
           //hacker get its reward via vesting contract
            tokenLock = tokenLockFactory.createTokenLock(
                address(HAT),
                governance(),
                _beneficiary,
                hackerReward,
                // solhint-disable-next-line not-rely-on-time
                block.timestamp, //start
                // solhint-disable-next-line not-rely-on-time
                block.timestamp + hatVestingDuration, //end
                hatVestingPeriods,
                0, //no release start
                0, //no cliff
                ITokenLock.Revocability.Disabled,
                true
            );
            HAT.transfer(tokenLock, hackerReward);
        }
        emit SwapAndSend(_pid, _beneficiary, amount, hackerReward, tokenLock);
        HAT.transfer(governance(), hatsReceived.sub(hackerReward).sub(burntHats));
    }

    function withdrawRequest(uint256 _pid) external {
      // solhint-disable-next-line not-rely-on-time
        require(block.timestamp > withdrawRequests[_pid][msg.sender] + withdrawRequestEnablePeriod,
        "pending withdraw request exist");
        // solhint-disable-next-line not-rely-on-time
        withdrawRequests[_pid][msg.sender] = block.timestamp + withdrawRequestPendingPeriod;
        emit WithdrawRequest(_pid, msg.sender, withdrawRequests[_pid][msg.sender]);
    }

    function deposit(uint256 _pid, uint256 _amount) external {
        //clear withdraw request
        withdrawRequests[_pid][msg.sender] = 0;
        _deposit(_pid, _amount);
    }

    function withdraw(uint256 _pid, uint256 _amount) external {
        checkWithdrawRequest(_pid);
        _withdraw(_pid, _amount);
    }

    function emergencyWithdraw(uint256 _pid) external {
        checkWithdrawRequest(_pid);
        _emergencyWithdraw(_pid);
    }

    function getPoolRewardsLevels(uint256 _poolId) external view returns(uint256[] memory) {
        return poolsRewards[_poolId].rewardsLevels;
    }

    function getPoolRewardsPendingLpToken(uint256 _poolId) external view returns(uint256) {
        return poolsRewards[_poolId].pendingLpTokenRewards;
    }

    function getPoolRewards(uint256 _poolId) external view returns(PoolReward memory) {
        return poolsRewards[_poolId];
    }

    // GET INFO for UI
    function getRewardPerBlock(uint256 pid1) external view returns (uint256) {
        uint256 multiplier = getMultiplier(block.number-1, block.number);
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

    function pendingReward(uint256 _pid, address _user) external view returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 rewardPerShare = pool.rewardPerShare;

        if (block.number > pool.lastRewardBlock && pool.totalUsersAmount > 0) {
            uint256 reward = calcPoolReward(_pid, pool.lastRewardBlock, globalPoolUpdates.length-1);
            rewardPerShare = rewardPerShare.add(reward.mul(1e12).div(pool.totalUsersAmount));
        }
        return user.amount.mul(rewardPerShare).div(1e12).sub(user.rewardDebt);
    }

    function getGlobalPoolUpdatesLength() external view returns (uint256) {
        return globalPoolUpdates.length;
    }

    function getStakedAmount(uint _pid, address _user) external view returns (uint256) {
        UserInfo storage user = userInfo[_pid][_user];
        return  user.amount;
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    function calcClaimRewards(uint256 _poolId, uint256 _severity)
    public
    view
    returns(ClaimReward memory claimRewards) {
        IERC20 lpToken = poolInfo[_poolId].lpToken;
        uint256 totalSupply = lpToken.balanceOf(address(this)).sub(poolsRewards[_poolId].pendingLpTokenRewards);
        require(totalSupply > 0, "totalSupply is zero");
        require(_severity < poolsRewards[_poolId].rewardsLevels.length, "_severity is not in the range");
        //hackingRewardAmount
        uint256 claimRewardAmount =
        totalSupply.mul(poolsRewards[_poolId].rewardsLevels[_severity]);
        claimRewards.hackerVestedReward =
        claimRewardAmount.mul(poolsRewards[_poolId].rewardsSplit.hackerVestedReward)
        .div(REWARDS_LEVEL_DENOMINATOR*REWARDS_LEVEL_DENOMINATOR);
        claimRewards.hackerReward =
        claimRewardAmount.mul(poolsRewards[_poolId].rewardsSplit.hackerReward)
        .div(REWARDS_LEVEL_DENOMINATOR*REWARDS_LEVEL_DENOMINATOR);
        claimRewards.committeeReward =
        claimRewardAmount.mul(poolsRewards[_poolId].rewardsSplit.committeeReward)
        .div(REWARDS_LEVEL_DENOMINATOR*REWARDS_LEVEL_DENOMINATOR);
        claimRewards.swapAndBurn =
        claimRewardAmount.mul(poolsRewards[_poolId].rewardsSplit.swapAndBurn)
        .div(REWARDS_LEVEL_DENOMINATOR*REWARDS_LEVEL_DENOMINATOR);
        claimRewards.governanceHatReward =
        claimRewardAmount.mul(poolsRewards[_poolId].rewardsSplit.governanceHatReward)
        .div(REWARDS_LEVEL_DENOMINATOR*REWARDS_LEVEL_DENOMINATOR);
        claimRewards.hackerHatReward =
        claimRewardAmount.mul(poolsRewards[_poolId].rewardsSplit.hackerHatReward)
        .div(REWARDS_LEVEL_DENOMINATOR*REWARDS_LEVEL_DENOMINATOR);
    }

    function getDefaultRewardsSplit() public pure returns (RewardsSplit memory) {
        return RewardsSplit({
            hackerVestedReward: 4500,
            hackerReward: 4000,
            committeeReward: 500,
            swapAndBurn: 250,
            governanceHatReward: 250,
            hackerHatReward: 400
        });
    }

    function validateSplit(RewardsSplit memory _rewardsSplit) internal pure {
        require(_rewardsSplit.hackerVestedReward
            .add(_rewardsSplit.hackerReward)
            .add(_rewardsSplit.committeeReward)
            .add(_rewardsSplit.swapAndBurn)
            .add(_rewardsSplit.governanceHatReward)
            .add(_rewardsSplit.hackerHatReward) < REWARDS_LEVEL_DENOMINATOR,
        "total split % should be less than 10000");
    }

    function checkWithdrawRequest(uint256 _pid) internal noPendingApproval(_pid) {
        //disable withdraw for 240 blocks each 3000 blocks.
        //to enable safe approveClaim period which prevents front running on committee approveClaim calls.
        require(block.number % (withdrawPeriod + safetyPeriod) < withdrawPeriod, "safty period");
      // solhint-disable-next-line not-rely-on-time
        require(block.timestamp > withdrawRequests[_pid][msg.sender] &&
      // solhint-disable-next-line not-rely-on-time
                block.timestamp < withdrawRequests[_pid][msg.sender] + withdrawRequestEnablePeriod,
                "withdraw request not valid");
        withdrawRequests[_pid][msg.sender] = 0;
    }

    function swapTokenForHAT(uint256 _amount,
                            IERC20 _token,
                            uint24 _fee,
                            uint256 _minOutputAmount,
                            uint160 _sqrtPriceLimitX96)
    internal
    returns (uint256 hatsReceived)
    {
        require(_token.approve(address(uniSwapRouter), _amount), "token approve failed");
        uint256 hatBalanceBefore = HAT.balanceOf(address(this));
        hatsReceived = uniSwapRouter.exactInputSingle(ISwapRouter.ExactInputSingleParams(
        address(_token),
        address(HAT),
        _fee,
        address(this),
        // solhint-disable-next-line not-rely-on-time
        block.timestamp,
        _amount,
        _minOutputAmount,
        _sqrtPriceLimitX96
        ));
        require(HAT.balanceOf(address(this)) == hatBalanceBefore.add(hatsReceived), "wrong amount received");
    }
}
