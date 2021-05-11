// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import "./interfaces/IUniswapV2Router01.sol";
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

    //pid -> (approver->boolean)
    mapping (uint256=>address) public committees;
    mapping(address => uint256) public swapAndBurns;
    //hackerAddress ->(token->amount)
    mapping(address => mapping(address => uint256)) public hackersHatRewards;
    //token -> amount
    mapping(address => uint256) public governanceHatRewards;

    //pid -> PendingApproval
    mapping(uint256 => PendingApproval) public pendingApprovals;

    uint256[] public defaultRewardLevel = [2000, 4000, 6000, 8000, 10000];
    uint256 internal constant REWARDS_LEVEL_DENOMINATOR = 10000;
    address public projectsRegistery;
    string public vaultName;
    ITokenLockFactory public immutable tokenLockFactory;
    uint256 public hatVestingDuration = 90 days;
    uint256 public hatVestingPeriods = 90;
    uint256 public constant WITHDRAW_PERIOD =  3000;
    uint256 public constant WITHDRAW_DISABLE_PERIOD =  240;
    IUniswapV2Router01 public immutable uniSwapRouter;

    modifier onlyWithdrawPeriod(uint256 _pid) {
        //disable withdraw for 240 blocks each 3000 blocks.
        //to enable safe approveClaim period which prevents front running on committee approveClaim calls.
        require(block.number % (WITHDRAW_PERIOD + WITHDRAW_DISABLE_PERIOD) < WITHDRAW_PERIOD, "safty period");
        require(pendingApprovals[_pid].beneficiary == address(0), "pending approval exist");
        _;
    }

    modifier onlyCommittee(uint256 _pid) {
        require(committees[_pid] == msg.sender, "only committee");
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

    /**
   * @dev constructor -
   * @param _rewardsToken the reward token address (HAT)
   * @param _rewardPerBlock the reward amount per block the contract will reward pools
   * @param _startBlock start block of of which the contract will start rewarding from.
   * @param _halvingAfterBlock a fix period value. each period will have its own multiplier value.
   *        which set the reward for each period. e.g a vaule of 100000 means that each such period is 100000 blocks.
   * @param _governance the governance address.
   *        Some of the contracts functions are limited only to governance :
   *         addPool,setPool,dismissPendingApprovalClaim,approveClaim,
   *         setHatVestingParams,setVestingParams,setRewardsSplit
   * @param _uniSwapRouter uni swap v2 rounter to be used to swap tokens for HAT token.
   * @param _tokenLockFactory address of the token lock factory to be used
   *        to create a vesting contract for the approved claim reporter.
 */
    constructor(
        address _rewardsToken,
        uint256 _rewardPerBlock,
        uint256 _startBlock,
        uint256 _halvingAfterBlock,
        address _governance,
        IUniswapV2Router01 _uniSwapRouter,
        ITokenLockFactory _tokenLockFactory
    ) HATMaster(HATToken(_rewardsToken), _rewardPerBlock, _startBlock, _halvingAfterBlock) {
        Governable.initialize(_governance);
        uniSwapRouter = _uniSwapRouter;
        tokenLockFactory = _tokenLockFactory;
    }

      /**
     * @dev pendingApprovalClaim - called by a commitee to set a pending approval claim.
     * The pending approval need to be approved or dismissd  by the hats governance.
     * This function should be called only on a safty period, where withdrawn is disable.
     * Upon a call to this function by the committee the pool withdrawn will be disable
     * till governance will approve or dismiss this pending approval.
     * @param _poolId pool id
     * @param _beneficiary the approval claim beneficiary
     * @param _severity approval claim severity
   */
    function pendingApprovalClaim(uint256 _poolId, address _beneficiary, uint256 _severity)
    external
    onlyCommittee(_poolId) {
        require(_beneficiary != address(0), "beneficiary is zero");
        require(pendingApprovals[_poolId].beneficiary == address(0), "there is already pending approval");
        require(block.number % (WITHDRAW_PERIOD + WITHDRAW_DISABLE_PERIOD) >= WITHDRAW_PERIOD,
        "none safty period");

        pendingApprovals[_poolId] = PendingApproval({
            beneficiary: _beneficiary,
            severity: _severity,
            approver: msg.sender
        });
        emit PendingApprovalLog(_poolId, _beneficiary, _severity, msg.sender);
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
    function approveClaim(uint256 _poolId) external onlyGovernance {
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
            block.timestamp, //start
            block.timestamp + poolReward.vestingDuration, //end
            poolReward.vestingPeriods,
            0, //no release start
            0, //no cliff
            ITokenLock.Revocability.Disabled,
            false
        );

        lpToken.safeTransfer(tokenLock, claimRewards.hackerVestedReward);
        lpToken.safeTransfer(pendingApproval.beneficiary, claimRewards.hackerReward);

        //approver get its rewards
        lpToken.safeTransfer(pendingApproval.approver, claimRewards.committeeReward);
        //storing the amount of token which can be swap and burned
        //so it could be swapAndBurn by any one in a seperate tx.

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
        require(lpToken.balanceOf(address(this)).sub(poolReward.pendingLpTokenRewards) > 0,
        "total supply cannot be zero");
    }

    //_descriptionHash - a hash of an ipfs encrypted file which describe the claim.
    // this can be use later on by the claimer to prove her claim
    function claim(string memory _descriptionHash) external {
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
   * each level should be less than 10000
   * @param _pid pool id
   * @param _rewardsLevels the reward levels array
 */
    function setRewardsLevels(uint256 _pid, uint256[] memory _rewardsLevels)
    external
    onlyCommittee(_pid) {
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

    //use also for committee checkin.
    function setCommittee(uint256 _pid, address _committee)
    external {
        require(_committee != address(0), "commitee is zero");
        //check if commitee already checked in.
        if (msg.sender == governance() && committees[_pid] != msg.sender) {
            require(!poolsRewards[_pid].committeeCheckIn, "Committee already checked in");
        } else {
            require(committees[_pid] == msg.sender, "only committee");
            poolsRewards[_pid].committeeCheckIn = true;
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
        uint256 poolId = poolLength()-1;
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
   * @param _registered does this pool is registered (default true)
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

    // swapBurnSend swap lptoken to HAT.
    // send to beneficiary and governance its hats rewards .
    // burn the rest of HAT.
    // only committee or governance are unauthorized to call this function.
    function swapBurnSend(uint256 _pid, address _beneficiary) external {
        //only committee or governance can call it.
        require(committees[_pid] == msg.sender || msg.sender == governance(), "only committee or governance");

        IERC20 token = poolInfo[_pid].lpToken;
        uint256 amountToSwapAndBurn = swapAndBurns[address(token)];
        uint256 amountForHackersHatRewards = hackersHatRewards[_beneficiary][address(token)];
        uint256 amountForGovernanceHatRewards = governanceHatRewards[address(token)];

        uint256 amount = amountToSwapAndBurn.add(amountForHackersHatRewards).add(amountForGovernanceHatRewards);
        require(amount > 0, "amount is zero");
        swapAndBurns[address(token)] = 0;
        governanceHatRewards[address(token)] = 0;
        hackersHatRewards[_beneficiary][address(token)] = 0;
        require(token.approve(address(uniSwapRouter), amount), "token approve failed");
        address[] memory path = new address[](2);
        path[0] = address(token);
        path[1] = address(HAT);
        //Swaps an exact amount of input tokens for as many output tokens as possible,
        //along the route determined by the path.
        uint256 hatBalanceBefore = HAT.balanceOf(address(this));
        uint256 hatsRecieved =
         // solhint-disable-next-line not-rely-on-time
        uniSwapRouter.swapExactTokensForTokens(amount, 0, path, address(this), block.timestamp)[1];
        require(HAT.balanceOf(address(this)) == hatBalanceBefore.add(hatsRecieved), "wrong amount received");
        poolsRewards[_pid].pendingLpTokenRewards = poolsRewards[_pid].pendingLpTokenRewards.sub(amount);
        uint256 burnetHats = hatsRecieved.mul(amountToSwapAndBurn).div(amount);

        if (burnetHats > 0) {
          //burn the relative HATs amount.
            HAT.burn(burnetHats);
        }
        emit SwapAndBurn(_pid, amount, burnetHats);
        address tokenLock;
        uint256 hackerReward = hatsRecieved.mul(amountForHackersHatRewards).div(amount);

        if (hackerReward > 0) {
           //hacker get its reward via vesting contract
            tokenLock = tokenLockFactory.createTokenLock(
                address(HAT),
                governance(),
                _beneficiary,
                hackerReward,
                block.timestamp, //start
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
        //send rest to governance
        HAT.transfer(governance(), hatsRecieved.sub(hackerReward).sub(burnetHats));
    }

    function withdraw(uint256 _pid, uint256 _amount) external onlyWithdrawPeriod(_pid) {
        _withdraw(_pid, _amount);
    }

    function emergencyWithdraw(uint256 _pid) external onlyWithdrawPeriod(_pid) {
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
        totalSupply.mul(poolsRewards[_poolId].rewardsLevels[_severity]).div(REWARDS_LEVEL_DENOMINATOR);
        claimRewards.hackerVestedReward =
        claimRewardAmount.mul(poolsRewards[_poolId].rewardsSplit.hackerVestedReward).div(REWARDS_LEVEL_DENOMINATOR);
        claimRewards.hackerReward =
        claimRewardAmount.mul(poolsRewards[_poolId].rewardsSplit.hackerReward).div(REWARDS_LEVEL_DENOMINATOR);
        claimRewards.committeeReward =
        claimRewardAmount.mul(poolsRewards[_poolId].rewardsSplit.committeeReward).div(REWARDS_LEVEL_DENOMINATOR);
        claimRewards.swapAndBurn =
        claimRewardAmount.mul(poolsRewards[_poolId].rewardsSplit.swapAndBurn).div(REWARDS_LEVEL_DENOMINATOR);
        claimRewards.governanceHatReward =
        claimRewardAmount.mul(poolsRewards[_poolId].rewardsSplit.governanceHatReward).div(REWARDS_LEVEL_DENOMINATOR);
        claimRewards.hackerHatReward =
        claimRewardAmount.mul(poolsRewards[_poolId].rewardsSplit.hackerHatReward).div(REWARDS_LEVEL_DENOMINATOR);
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
}
