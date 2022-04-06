// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.6;
import "./interfaces/ISwapRouter.sol";
import "openzeppelin-solidity/contracts/token/ERC20/utils/SafeERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "./HATMaster.sol";
import "./tokenlock/ITokenLockFactory.sol";

// Errors:
// HVE01: Only committee
// HVE02: Pending approval exist
// HVE03: Safety period
// HVE04: Beneficiary is zero
// HVE05: Not safety period
// HVE06: _severity is not in the range
// HVE07: Withdraw request pending period must be <= 3 months
// HVE08: Withdraw request enabled period must be >= 6 hour
// HVE09: Only callable by governance or after 5 weeks
// HVE10: No pending approval
// HVE11: Amount to reward is too big
// HVE12: Withdraw period must be >= 1 hour
// HVE13: Safety period must be <= 6 hours
// HVE14: Not enough fee paid
// HVE15: Vesting duration is too long
// HVE16: Vesting periods cannot be zero
// HVE17: Vesting duration smaller than periods
// HVE18: Delay is too short
// HVE19: No pending set rewards levels
// HVE20: Cannot confirm setRewardsLevels at this time
// HVE21: Committee is zero
// HVE22: Committee already checked in
// HVE23: Pool does not exist
// HVE24: Amount is zero
// HVE25: Pending withdraw request exist
// HVE26: Deposit paused
// HVE27: Amount less than 1e6
// HVE28: totalSupply is zero
// HVE29: Total split % should be 10000
// HVE30: Withdraw request is invalid
// HVE31: Token approve failed
// HVE32: Wrong amount received
// HVE33: Reward level can not be more than 10000
// HVE34: LP token is zero
// HVE35: Only fee setter
// HVE36: Fee must be less than 2%
// HVE37: Token approve reset failed
contract  HATVaults is HATMaster {
    using SafeMath  for uint256;
    using SafeERC20 for IERC20;

    struct PendingApproval {
        address beneficiary;
        uint256 severity;
        address approver;
        uint256 createdAt;
    }

    struct ClaimReward {
        uint256 hackerVestedReward;
        uint256 hackerReward;
        uint256 committeeReward;
        uint256 swapAndBurn;
        uint256 governanceHatReward;
        uint256 hackerHatReward;
    }

    struct PendingRewardsLevels {
        uint256 timestamp;
        uint256[] rewardsLevels;
    }

    struct GeneralParameters {
        uint256 hatVestingDuration;
        uint256 hatVestingPeriods;
        uint256 withdrawPeriod;
        uint256 safetyPeriod; //withdraw disable period in seconds
        uint256 setRewardsLevelsDelay;
        uint256 withdrawRequestEnablePeriod;
        uint256 withdrawRequestPendingPeriod;
        uint256 claimFee;  //claim fee in ETH
    }

    //pid -> committee address
    mapping(uint256=>address) public committees;
    //pid -> amount
    mapping(uint256 => uint256) public swapAndBurns;
    //hackerAddress ->(pid->amount)
    mapping(address => mapping(uint256 => uint256)) public hackersHatRewards;
    //pid -> amount
    mapping(uint256 => uint256) public governanceHatRewards;
    //pid -> PendingApproval
    mapping(uint256 => PendingApproval) public pendingApprovals;
    //poolId -> (address -> requestTime)
    mapping(uint256 => mapping(address => uint256)) public withdrawRequests;
    //poolId -> PendingRewardsLevels
    mapping(uint256 => PendingRewardsLevels) public pendingRewardsLevels;

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

    modifier noPendingApproval(uint256 _pid) {
        require(pendingApprovals[_pid].beneficiary == address(0), "HVE02");
        _;
    }

    modifier noSafetyPeriod() {
      //disable withdraw for safetyPeriod (e.g 1 hour) each withdrawPeriod(e.g 11 hours)
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

    event SetCommittee(uint256 indexed _pid, address indexed _committee);

    event AddPool(uint256 indexed _pid,
                uint256 indexed _allocPoint,
                address indexed _lpToken,
                address _committee,
                string _descriptionHash,
                uint256[] _rewardsLevels,
                RewardsSplit _rewardsSplit,
                uint256 _rewardVestingDuration,
                uint256 _rewardVestingPeriods);

    event SetPool(uint256 indexed _pid, uint256 indexed _allocPoint, bool indexed _registered, string _descriptionHash);
    event Claim(address indexed _claimer, string _descriptionHash);
    event SetRewardsSplit(uint256 indexed _pid, RewardsSplit _rewardsSplit);
    event SetRewardsLevels(uint256 indexed _pid, uint256[] _rewardsLevels);
    event SetFeeSetter(address indexed _newFeeSetter);
    event SetPoolFee(uint256 indexed _pid, uint256 _newFee);
    event PendingRewardsLevelsLog(uint256 indexed _pid, uint256[] _rewardsLevels, uint256 _timeStamp);

    event SwapAndSend(uint256 indexed _pid,
                    address indexed _beneficiary,
                    uint256 indexed _amountSwaped,
                    uint256 _amountReceived,
                    address _tokenLock);

    event SwapAndBurn(uint256 indexed _pid, uint256 indexed _amountSwaped, uint256 indexed _amountBurned);
    event SetVestingParams(uint256 indexed _pid, uint256 indexed _duration, uint256 indexed _periods);
    event SetHatVestingParams(uint256 indexed _duration, uint256 indexed _periods);

    event ClaimApprove(address indexed _approver,
                    uint256 indexed _pid,
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

    event RewardDepositors(uint256 indexed _pid, uint256 indexed _amount);

    /**
   * @dev constructor -
   * @param _rewardsToken the reward token address (HAT)
   * @param _rewardPerBlock the reward amount per block the contract will reward pools
   * @param _startBlock start block of of which the contract will start rewarding from.
   * @param _multiplierPeriod a fix period value. each period will have its own multiplier value.
   *        which set the reward for each period. e.g a value of 100000 means that each such period is 100000 blocks.
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
        uint256 _multiplierPeriod,
        address _hatGovernance,
        ISwapRouter _uniSwapRouter,
        ITokenLockFactory _tokenLockFactory
    // solhint-disable-next-line func-visibility
    ) HATMaster(HATToken(_rewardsToken), _rewardPerBlock, _startBlock, _multiplierPeriod) {
        Governable.initialize(_hatGovernance);
        uniSwapRouter = _uniSwapRouter;
        tokenLockFactory = _tokenLockFactory;
        generalParameters = GeneralParameters({
            hatVestingDuration: 90 days,
            hatVestingPeriods:90,
            withdrawPeriod: 11 hours,
            safetyPeriod: 1 hours,
            setRewardsLevelsDelay: 2 days,
            withdrawRequestEnablePeriod: 7 days,
            withdrawRequestPendingPeriod: 7 days,
            claimFee: 0
        });
    }

      /**
     * @dev pendingApprovalClaim - called by a committee to set a pending approval claim.
     * The pending approval need to be approved or dismissed  by the hats governance.
     * This function should be called only on a safety period, where withdrawn is disable.
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
        require(_beneficiary != address(0), "HVE04");
        // solhint-disable-next-line not-rely-on-time
        require(block.timestamp % (generalParameters.withdrawPeriod + generalParameters.safetyPeriod) >=
        generalParameters.withdrawPeriod,
        "HVE05");
        require(_severity < poolsRewards[_pid].rewardsLevels.length, "HVE06");

        pendingApprovals[_pid] = PendingApproval({
            beneficiary: _beneficiary,
            severity: _severity,
            approver: msg.sender,
            // solhint-disable-next-line not-rely-on-time
            createdAt: block.timestamp
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
        require(90 days >= _withdrawRequestPendingPeriod, "HVE07");
        require(6 hours <= _withdrawRequestEnablePeriod, "HVE08");
        generalParameters.withdrawRequestPendingPeriod = _withdrawRequestPendingPeriod;
        generalParameters.withdrawRequestEnablePeriod = _withdrawRequestEnablePeriod;
    }

  /**
   * @dev dismiss a pending claim - called either by hats govenrance, or by anyone if the claim is over 5 weeks old
   * @param _pid pool id
  */
    function dismissPendingApprovalClaim(uint256 _pid) external {
        // solhint-disable-next-line not-rely-on-time
        require(msg.sender == governance() || pendingApprovals[_pid].createdAt + 5 weeks < block.timestamp, "HVE09");
        delete pendingApprovals[_pid];
    }

    /**
   * @dev approveClaim - called by hats governance to approve a pending approval claim.
   * @param _pid pool id
 */
    function approveClaim(uint256 _pid) external onlyGovernance nonReentrant {
        require(pendingApprovals[_pid].beneficiary != address(0), "HVE10");
        PoolReward storage poolReward = poolsRewards[_pid];
        PendingApproval memory pendingApproval = pendingApprovals[_pid];
        delete pendingApprovals[_pid];

        IERC20 lpToken = poolInfo[_pid].lpToken;
        ClaimReward memory claimRewards = calcClaimRewards(_pid, pendingApproval.severity);
        poolInfo[_pid].balance = poolInfo[_pid].balance.sub(
                            claimRewards.hackerReward
                            .add(claimRewards.hackerVestedReward)
                            .add(claimRewards.committeeReward)
                            .add(claimRewards.swapAndBurn)
                            .add(claimRewards.hackerHatReward)
                            .add(claimRewards.governanceHatReward));
        address tokenLock;
        if (claimRewards.hackerVestedReward > 0) {
        //hacker get its reward to a vesting contract
            tokenLock = tokenLockFactory.createTokenLock(
            address(lpToken),
            0x000000000000000000000000000000000000dEaD, //this address as owner, so it can do nothing.
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
        }
        lpToken.safeTransfer(pendingApproval.beneficiary, claimRewards.hackerReward);
        lpToken.safeTransfer(pendingApproval.approver, claimRewards.committeeReward);
        //storing the amount of token which can be swap and burned so it could be swapAndBurn in a seperate tx.
        swapAndBurns[_pid] = swapAndBurns[_pid].add(claimRewards.swapAndBurn);
        governanceHatRewards[_pid] =
        governanceHatRewards[_pid].add(claimRewards.governanceHatReward);
        hackersHatRewards[pendingApproval.beneficiary][_pid] =
        hackersHatRewards[pendingApproval.beneficiary][_pid].add(claimRewards.hackerHatReward);

        emit ClaimApprove(msg.sender,
                        _pid,
                        pendingApproval.beneficiary,
                        pendingApproval.severity,
                        tokenLock,
                        claimRewards);
        assert(poolInfo[_pid].balance > 0);
    }

    /**
     * @dev rewardDepositors - add funds to pool to reward depositors.
     * The funds will be given to depositors pro rata upon withdraw
     * @param _pid pool id
     * @param _amount amount to add
    */
    function rewardDepositors(uint256 _pid, uint256 _amount) external {
        require(poolInfo[_pid].balance.add(_amount).div(MINIMUM_DEPOSIT) < poolInfo[_pid].totalUsersAmount,
        "HVE11");
        poolInfo[_pid].lpToken.safeTransferFrom(msg.sender, address(this), _amount);
        poolInfo[_pid].balance = poolInfo[_pid].balance.add(_amount);
        emit RewardDepositors(_pid, _amount);
    }

    /**
     * @dev setRewardMultipliers - called by hats governance to set reward multipliers
     * @param _rewardMultipliers reward multipliers
    */
    function setRewardMultipliers(uint256[24] memory _rewardMultipliers) external onlyGovernance {
        rewardMultipliers = _rewardMultipliers;
    }

    /**
     * @dev setClaimFee - called by hats governance to set claim fee
     * @param _fee claim fee in ETH
    */
    function setClaimFee(uint256 _fee) external onlyGovernance {
        generalParameters.claimFee = _fee;
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
        emit SetWithdrawSafetyPeriod(generalParameters.withdrawPeriod, generalParameters.safetyPeriod);
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
        require(_duration < 180 days, "HVE15");
        require(_periods > 0, "HVE16");
        require(_duration >= _periods, "HVE17");
        generalParameters.hatVestingDuration = _duration;
        generalParameters.hatVestingPeriods = _periods;
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
    onlyGovernance noPendingApproval(_pid) noSafetyPeriod {
        validateSplit(_rewardsSplit);
        poolsRewards[_pid].rewardsSplit = _rewardsSplit;
        emit SetRewardsSplit(_pid, _rewardsSplit);
    }

    /**
   * @dev setRewardsLevelsDelay - set the timelock delay for setting rewars level
   * @param _delay time delay
 */
    function setRewardsLevelsDelay(uint256 _delay)
    external
    onlyGovernance {
        require(_delay >= 2 days, "HVE18");
        generalParameters.setRewardsLevelsDelay = _delay;
    }

    /**
   * @dev setPendingRewardsLevels - set pending request to set pool token rewards level.
   * the reward level represent the percentage of the pool's token which will be split as a reward.
   * the function can be called only by the pool committee.
   * cannot be called if there already pending approval.
   * each level should be less than 10000
   * @param _pid pool id
   * @param _rewardsLevels the reward levels array
 */
    function setPendingRewardsLevels(uint256 _pid, uint256[] memory _rewardsLevels)
    external
    onlyCommittee(_pid) noPendingApproval(_pid) {
        pendingRewardsLevels[_pid].rewardsLevels = checkRewardsLevels(_rewardsLevels);
        // solhint-disable-next-line not-rely-on-time
        pendingRewardsLevels[_pid].timestamp = block.timestamp;
        emit PendingRewardsLevelsLog(_pid, _rewardsLevels, pendingRewardsLevels[_pid].timestamp);
    }

  /**
   * @dev setRewardsLevels - set the pool token rewards level of already pending set rewards level.
   * see pendingRewardsLevels
   * the reward level represent the percentage of the pool's token which will be split as a reward.
   * the function can be called only by the pool committee.
   * cannot be called if there already pending approval.
   * each level should be less than 10000
   * @param _pid pool id
 */
    function setRewardsLevels(uint256 _pid)
    external
    onlyCommittee(_pid) noPendingApproval(_pid) {
        require(pendingRewardsLevels[_pid].timestamp > 0, "HVE19");
        // solhint-disable-next-line not-rely-on-time
        require(block.timestamp - pendingRewardsLevels[_pid].timestamp > generalParameters.setRewardsLevelsDelay, "HVE20");
        poolsRewards[_pid].rewardsLevels = pendingRewardsLevels[_pid].rewardsLevels;
        delete pendingRewardsLevels[_pid];
        emit SetRewardsLevels(_pid, poolsRewards[_pid].rewardsLevels);
    }

    /**
   * @dev committeeCheckIn - committee check in.
   * deposit is enable only after committee check in
   * @param _pid pool id
 */
    function committeeCheckIn(uint256 _pid) external onlyCommittee(_pid) {
        poolsRewards[_pid].committeeCheckIn = true;
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
            require(!poolsRewards[_pid].committeeCheckIn, "HVE22");
        } else {
            require(committees[_pid] == msg.sender, "HVE01");
        }

        committees[_pid] = _committee;

        emit SetCommittee(_pid, _committee);
    }

    /**
   * @dev addPool - only Governance
   * @param _allocPoint the pool allocation point
   * @param _lpToken pool token
   * @param _committee pool committee address
   * @param _rewardsLevels pool reward levels(sevirities)
     each level is a number between 0 and 10000.
   * @param _rewardsSplit pool reward split.
     each entry is a number between 0 and 10000.
     total splits should be equal to 10000
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
        require(_rewardVestingParams[0] < 120 days, "HVE15");
        require(_rewardVestingParams[1] > 0, "HVE16");
        require(_rewardVestingParams[0] >= _rewardVestingParams[1], "HVE17");
        require(_committee != address(0), "HVE21");
        require(_lpToken != address(0), "HVE34");
        add(_allocPoint, IERC20(_lpToken));
        uint256 poolId = poolInfo.length-1;
        committees[poolId] = _committee;
        uint256[] memory rewardsLevels = checkRewardsLevels(_rewardsLevels);

        RewardsSplit memory rewardsSplit = (_rewardsSplit.hackerVestedReward == 0 && _rewardsSplit.hackerReward == 0) ?
        getDefaultRewardsSplit() : _rewardsSplit;

        validateSplit(rewardsSplit);
        poolsRewards[poolId] = PoolReward({
            rewardsLevels: rewardsLevels,
            rewardsSplit: rewardsSplit,
            committeeCheckIn: false,
            vestingDuration: _rewardVestingParams[0],
            vestingPeriods: _rewardVestingParams[1]
        });

        emit AddPool(poolId,
                    _allocPoint,
                    address(_lpToken),
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
   * @param _depositPause pause pool deposit (default false).
   * This parameter can be used by the UI to include or exclude the pool
   * @param _descriptionHash the hash of the pool description.
 */
    function setPool(uint256 _pid,
                    uint256 _allocPoint,
                    bool _registered,
                    bool _depositPause,
                    string memory _descriptionHash)
    external onlyGovernance {
        require(poolInfo.length > _pid, "HVE23");
        set(_pid, _allocPoint);
        poolDepositPause[_pid] = _depositPause;
        emit SetPool(_pid, _allocPoint, _registered, _descriptionHash);
    }

    function setFeeSetter(address _newFeeSetter) external onlyGovernance {
        feeSetter = _newFeeSetter;
        emit SetFeeSetter(_newFeeSetter);
    }

    function setPoolFee(uint256 _pid, uint256 _newFee) external onlyFeeSetter {
        require(_newFee <= MAX_FEE, "HVE36");
        poolInfo[_pid].fee = _newFee;
        emit SetPoolFee(_pid, _newFee);
    }

    /**
    * @dev swapBurnSend swap lptoken to HAT.
    * send to beneficiary and governance its hats rewards .
    * burn the rest of HAT.
    * only governance are authorized to call this function.
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
        IERC20 token = poolInfo[_pid].lpToken;
        uint256 amountToSwapAndBurn = swapAndBurns[_pid];
        uint256 amountForHackersHatRewards = hackersHatRewards[_beneficiary][_pid];
        uint256 amount = amountToSwapAndBurn.add(amountForHackersHatRewards).add(governanceHatRewards[_pid]);
        require(amount > 0, "HVE24");
        swapAndBurns[_pid] = 0;
        governanceHatRewards[_pid] = 0;
        hackersHatRewards[_beneficiary][_pid] = 0;
        uint256 hatsReceived = swapTokenForHAT(amount, token, _fees, _amountOutMinimum);
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
        HAT.transfer(governance(), hatsReceived.sub(hackerReward).sub(burntHats));
    }

    /**
    * @dev withdrawRequest submit a withdraw request
    * @param _pid the pool id
    **/
    function withdrawRequest(uint256 _pid) external {
      // solhint-disable-next-line not-rely-on-time
        require(block.timestamp > withdrawRequests[_pid][msg.sender] + generalParameters.withdrawRequestEnablePeriod, "HVE25");
        // solhint-disable-next-line not-rely-on-time
        withdrawRequests[_pid][msg.sender] = block.timestamp + generalParameters.withdrawRequestPendingPeriod;
        emit WithdrawRequest(_pid, msg.sender, withdrawRequests[_pid][msg.sender]);
    }

    /**
    * @dev deposit deposit to pool
    * @param _pid the pool id
    * @param _amount amount of pool's token to deposit
    **/
    function deposit(uint256 _pid, uint256 _amount) external {
        require(!poolDepositPause[_pid], "HVE26");
        require(_amount >= MINIMUM_DEPOSIT, "HVE27");
        //clear withdraw request
        withdrawRequests[_pid][msg.sender] = 0;
        _deposit(_pid, _amount);
    }

    /**
    * @dev withdraw  - withdraw user's pool share.
    * user need first to submit a withdraw request.
    * @param _pid the pool id
    * @param _shares amount of shares user wants to withdraw
    **/
    function withdraw(uint256 _pid, uint256 _shares) external {
        checkWithdrawRequest(_pid);
        _withdraw(_pid, _shares);
    }

    /**
    * @dev emergencyWithdraw withdraw all user's pool share without claim for reward.
    * user need first to submit a withdraw request.
    * @param _pid the pool id
    **/
    function emergencyWithdraw(uint256 _pid) external {
        checkWithdrawRequest(_pid);
        _emergencyWithdraw(_pid);
    }

    function getPoolRewardsLevels(uint256 _pid) external view returns(uint256[] memory) {
        return poolsRewards[_pid].rewardsLevels;
    }

    function getPoolRewards(uint256 _pid) external view returns(PoolReward memory) {
        return poolsRewards[_pid];
    }

    // GET INFO for UI
    /**
    * @dev getRewardPerBlock return the current pool reward per block
    * @param _pid1 the pool id.
    *        if _pid1 = 0 , it return the current block reward for whole pools.
    *        otherwise it return the current block reward for _pid1-1.
    * @return rewardPerBlock
    **/
    function getRewardPerBlock(uint256 _pid1) external view returns (uint256) {
        if (_pid1 == 0) {
            return getRewardForBlocksRange(block.number-1, block.number, 1, 1);
        } else {
            return getRewardForBlocksRange(block.number-1,
                                        block.number,
                                        poolInfo[_pid1 - 1].allocPoint,
                                        globalPoolUpdates[globalPoolUpdates.length-1].totalAllocPoint);
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

    function calcClaimRewards(uint256 _pid, uint256 _severity)
    public
    view
    returns(ClaimReward memory claimRewards) {
        uint256 totalSupply = poolInfo[_pid].balance;
        require(totalSupply > 0, "HVE28");
        require(_severity < poolsRewards[_pid].rewardsLevels.length, "HVE06");
        //hackingRewardAmount
        uint256 claimRewardAmount =
        totalSupply.mul(poolsRewards[_pid].rewardsLevels[_severity]);
        claimRewards.hackerVestedReward =
        claimRewardAmount.mul(poolsRewards[_pid].rewardsSplit.hackerVestedReward)
        .div(HUNDRED_PERCENT*HUNDRED_PERCENT);
        claimRewards.hackerReward =
        claimRewardAmount.mul(poolsRewards[_pid].rewardsSplit.hackerReward)
        .div(HUNDRED_PERCENT*HUNDRED_PERCENT);
        claimRewards.committeeReward =
        claimRewardAmount.mul(poolsRewards[_pid].rewardsSplit.committeeReward)
        .div(HUNDRED_PERCENT*HUNDRED_PERCENT);
        claimRewards.swapAndBurn =
        claimRewardAmount.mul(poolsRewards[_pid].rewardsSplit.swapAndBurn)
        .div(HUNDRED_PERCENT*HUNDRED_PERCENT);
        claimRewards.governanceHatReward =
        claimRewardAmount.mul(poolsRewards[_pid].rewardsSplit.governanceHatReward)
        .div(HUNDRED_PERCENT*HUNDRED_PERCENT);
        claimRewards.hackerHatReward =
        claimRewardAmount.mul(poolsRewards[_pid].rewardsSplit.hackerHatReward)
        .div(HUNDRED_PERCENT*HUNDRED_PERCENT);
    }

    function getDefaultRewardsSplit() public pure returns (RewardsSplit memory) {
        return RewardsSplit({
            hackerVestedReward: 6000,
            hackerReward: 2000,
            committeeReward: 500,
            swapAndBurn: 0,
            governanceHatReward: 1000,
            hackerHatReward: 500
        });
    }

    function validateSplit(RewardsSplit memory _rewardsSplit) internal pure {
        require(_rewardsSplit.hackerVestedReward
            .add(_rewardsSplit.hackerReward)
            .add(_rewardsSplit.committeeReward)
            .add(_rewardsSplit.swapAndBurn)
            .add(_rewardsSplit.governanceHatReward)
            .add(_rewardsSplit.hackerHatReward) == HUNDRED_PERCENT,
        "HVE29");
    }

    function checkWithdrawRequest(uint256 _pid) internal noPendingApproval(_pid) noSafetyPeriod {
      // solhint-disable-next-line not-rely-on-time
        require(block.timestamp > withdrawRequests[_pid][msg.sender] &&
      // solhint-disable-next-line not-rely-on-time
                block.timestamp < withdrawRequests[_pid][msg.sender] + generalParameters.withdrawRequestEnablePeriod,
                "HVE30");
        withdrawRequests[_pid][msg.sender] = 0;
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
   * @dev checkRewardsLevels - check rewards levels.
   * each level should be less than 10000
   * if _rewardsLevels length is 0 a default reward levels will be return
   * default reward levels = [2000, 4000, 6000, 8000]
   * @param _rewardsLevels the reward levels array
   * @return rewardsLevels
 */
    function checkRewardsLevels(uint256[] memory _rewardsLevels)
    private
    pure
    returns (uint256[] memory rewardsLevels) {

        uint256 i;
        if (_rewardsLevels.length == 0) {
            rewardsLevels = new uint256[](4);
            for (i; i < 4; i++) {
              //defaultRewardLevels = [2000, 4000, 6000, 8000];
                rewardsLevels[i] = 2000*(i+1);
            }
        } else {
            for (i; i < _rewardsLevels.length; i++) {
                require(_rewardsLevels[i] < HUNDRED_PERCENT, "HVE33");
            }
            rewardsLevels = _rewardsLevels;
        }
    }
}
