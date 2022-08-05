// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.14;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "./tokenlock/TokenLockFactory.sol";
import "./interfaces/IRewardController.sol";
import "./HATVaultsRegistry.sol";


// Errors:
// Only committee
error OnlyCommittee();
// Active claim exists
error ActiveClaimExists();
// Safety period
error SafetyPeriod();
// Beneficiary is zero
error BeneficiaryIsZero();
// Not safety period
error NotSafetyPeriod();
// Bounty percentage is higher than the max bounty
error BountyPercentageHigherThanMaxBounty();
// Only callable by arbitrator or after challenge timeout period
error OnlyCallableByArbitratorOrAfterChallengeTimeOutPeriod();
// No active claim exists
error NoActiveClaimExists();
// Not enough fee paid
error NotEnoughFeePaid();
// No pending max bounty
error NoPendingMaxBounty();
// Delay period for setting max bounty had not passed
error DelayPeriodForSettingMaxBountyHadNotPassed();
// Committee is zero
error CommitteeIsZero();
// Committee already checked in
error CommitteeAlreadyCheckedIn();
// Pool does not exist
error PoolDoesNotExist();
// Amount to swap is zero
error AmountToSwapIsZero();
// Pending withdraw request exists
error PendingWithdrawRequestExists();
// Deposit paused
error DepositPaused();
// Amount to deposit is zero
error AmountToDepositIsZero();
// Pool balance is zero
error PoolBalanceIsZero();
// Total bounty split % should be `HUNDRED_PERCENT`
error TotalSplitPercentageShouldBeHundredPercent();
// Withdraw request is invalid
error InvalidWithdrawRequest();
// Token approve failed
error TokenApproveFailed();
// Wrong amount received
error AmountSwappedLessThanMinimum();
// Max bounty cannot be more than `HUNDRED_PERCENT`
error MaxBountyCannotBeMoreThanHundredPercent();
// LP token is zero
error LPTokenIsZero();
// Only fee setter
error OnlyFeeSetter();
// Fee must be less than or equal to 2%
error PoolWithdrawalFeeTooBig();
// Token approve reset failed
error TokenApproveResetFailed();
// Pool must not be initialized
error PoolMustNotBeInitialized();
// Pool must be initialized
error PoolMustBeInitialized();
// Set shares arrays must have same length
error SetSharesArraysMustHaveSameLength();
// Committee not checked in yet
error CommitteeNotCheckedInYet();
// Not enough user balance
error NotEnoughUserBalance();
// User shares must be greater than 0
error UserSharesMustBeGreaterThanZero();
// Swap was not successful
error SwapFailed();
// Routing contract must be whitelisted
error RoutingContractNotWhitelisted();
// Only arbitrator
error OnlyArbitrator();
// Claim can only be approved if challenge period is over, or if the
// caller is the arbitrator
error ClaimCanOnlyBeApprovedAfterChallengePeriodOrByArbitrator();
// Bounty split must include hacker payout
error BountySplitMustIncludeHackerPayout();
error ChallengePeriodEnded();
error OnlyCallableIfChallenged();

contract HATVault is OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;
    using SafeERC20 for ERC20Burnable;

    // How to divide the bounties for each pool, in percentages (out of `HUNDRED_PERCENT`)
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
        // the percentage of the total bounty to be swapped to HATs and sent to the hacker via vesting contract
        uint256 hackerHatVested;
    }

    // How to divide a bounty for a claim that has been approved, in amounts of pool's tokens
    struct ClaimBounty {
        uint256 hacker;
        uint256 hackerVested;
        uint256 committee;
        uint256 swapAndBurn;
        uint256 hackerHatVested;
        uint256 governanceHat;
    }

    struct Claim {
        address beneficiary;
        uint256 bountyPercentage;
        // the address of the committee at the time of the submittal, so that this committee will
        // be paid their share of the bounty in case the committee changes before claim approval
        address committee;
        uint256 createdAt;
        bool isChallenged;
    }

    struct PendingMaxBounty {
        uint256 maxBounty;
        uint256 timestamp;
    }

    uint256 public constant HUNDRED_PERCENT = 10000;
    uint256 public constant MAX_FEE = 200; // Max fee is 2%

    HATVaultsRegistry public registry;
    ITokenLockFactory public tokenLockFactory;
    ERC20Burnable public swapToken;

    uint256 public activeClaim;
    // claimId -> Claim
    mapping(uint256 => Claim) public claims;

    IRewardController public rewardController;

    mapping(address => uint256) public userShares;

    BountySplit public bountySplit;
    uint256 public maxBounty;
    uint256 public vestingDuration;
    uint256 public vestingPeriods;

    bool public committeeCheckedIn;
    IERC20 public lpToken;
    uint256 public balance;
    uint256 public totalShares;
    uint256 public withdrawalFee;

    uint256 internal nonce;

    address public committee;

    PendingMaxBounty public pendingMaxBounty;

    bool public poolDepositPause;
    bool public poolInitialized;

    mapping(address => uint256) public withdrawEnableStartTime;

    uint256 public swapAndBurn;
    mapping(address => uint256) public hackersHatReward;
    uint256 public governanceHatReward;
    
    event LogClaim(address indexed _claimer, string _descriptionHash);
    event SubmitClaim(
        uint256 indexed _claimId,
        address _committee,
        address indexed _beneficiary,
        uint256 indexed _bountyPercentage,
        string _descriptionHash
    );
    event ApproveClaim(
        uint256 indexed _claimId,
        address indexed _committee,
        address indexed _beneficiary,
        uint256 _bountyPercentage,
        address _tokenLock,
        ClaimBounty _claimBounty
    );
    event DismissClaim(uint256 indexed _claimId);
    event Deposit(address indexed user,
        uint256 amount,
        uint256 transferredAmount
    );
    event SetCommittee(address indexed _committee);
    event SetVestingParams(
        uint256 indexed _duration,
        uint256 indexed _periods
    );
    event SetBountySplit(BountySplit _bountySplit);
    event SetPoolWithdrawalFee(uint256 _newFee);
    event CommitteeCheckedIn();
    event SetPendingMaxBounty(uint256 _maxBounty, uint256 _timeStamp);
    event SetMaxBounty(uint256 _maxBounty);
    event SetRewardController(IRewardController indexed _newRewardController);
    event SetPool(
        bool indexed _registered,
        bool _depositPause,
        string _descriptionHash
    );
    event SwapAndBurn(
        uint256 indexed _amountSwapped,
        uint256 indexed _amountBurned
    );
    event SwapAndSend(
        address indexed _beneficiary,
        uint256 indexed _amountSwapped,
        uint256 _amountReceived,
        address _tokenLock
    );
    event WithdrawRequest(
        address indexed _beneficiary,
        uint256 indexed _withdrawEnableTime
    );
    event Withdraw(address indexed user, uint256 shares);
    event EmergencyWithdraw(address indexed user, uint256 amount);

    modifier onlyFeeSetter() {
        if (registry.feeSetter() != msg.sender) revert OnlyFeeSetter();
        _;
    }

    modifier onlyCommittee() {
        if (committee != msg.sender) revert OnlyCommittee();
        _;
    }

    modifier onlyArbitrator() {
        if (registry.arbitrator() != msg.sender) revert OnlyArbitrator();
        _;
    }

    modifier noSafetyPeriod() {
        HATVaultsRegistry.GeneralParameters memory generalParameters = registry.getGeneralParameters();
        //disable withdraw for safetyPeriod (e.g 1 hour) after each withdrawPeriod(e.g 11 hours)
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp %
        (generalParameters.withdrawPeriod + generalParameters.safetyPeriod) >=
            generalParameters.withdrawPeriod) revert SafetyPeriod();
        _;
    }

    modifier noActiveClaim() {
        if (activeClaim != 0) revert ActiveClaimExists();
        _;
    }

    function initialize(
        IRewardController _rewardController,
        uint256 _vestingDuration,
        uint256 _vestingPeriods,
        uint256 _maxBounty,
        BountySplit memory _bountySplit,
        IERC20 _lpToken,
        address _committee,
        bool _isPaused
    ) external initializer {
        if (_vestingDuration > 120 days)
            revert VestingDurationTooLong();
        if (_vestingPeriods == 0) revert VestingPeriodsCannotBeZero();
        if (_vestingDuration < _vestingPeriods)
            revert VestingDurationSmallerThanPeriods();
        if (_committee == address(0)) revert CommitteeIsZero();
        if (address(_lpToken) == address(0)) revert LPTokenIsZero();
        if (_maxBounty > HUNDRED_PERCENT)
            revert MaxBountyCannotBeMoreThanHundredPercent();
        validateSplit(_bountySplit);
        rewardController = _rewardController;
        lpToken = _lpToken;
        vestingDuration = _vestingDuration;
        vestingPeriods = _vestingPeriods;
        maxBounty = _maxBounty;
        bountySplit = _bountySplit;
        committee = _committee;
        poolDepositPause = _isPaused;
        HATVaultsRegistry _registry = HATVaultsRegistry(msg.sender);
        registry = _registry;
        __ReentrancyGuard_init();
        _transferOwnership(_registry.owner());
        swapToken = _registry.swapToken();
        tokenLockFactory = _registry.tokenLockFactory();
    }

    function validateSplit(BountySplit memory _bountySplit) internal pure {
        if (_bountySplit.hacker + _bountySplit.hackerVested == 0) 
            revert BountySplitMustIncludeHackerPayout();

        if (_bountySplit.hackerVested +
            _bountySplit.hacker +
            _bountySplit.committee +
            _bountySplit.swapAndBurn +
            _bountySplit.governanceHat +
            _bountySplit.hackerHatVested != HUNDRED_PERCENT)
            revert TotalSplitPercentageShouldBeHundredPercent();
    }

    /* ----------------------------------- Claim -------------------------------------- */

    /**
    * @notice emit an event that includes the given _descriptionHash
    * This can be used by the claimer as evidence that she had access to the information at the time of the call
    * if a claimFee > 0, the caller must send claimFee Ether for the claim to succeed
    * @param _descriptionHash - a hash of an ipfs encrypted file which describes the claim.
    */
    function logClaim(string memory _descriptionHash) external payable {
        HATVaultsRegistry.GeneralParameters memory generalParameters = registry.getGeneralParameters();
        if (generalParameters.claimFee > 0) {
            if (msg.value < generalParameters.claimFee)
                revert NotEnoughFeePaid();
            // solhint-disable-next-line indent
            payable(owner()).transfer(msg.value);
        }
        emit LogClaim(msg.sender, _descriptionHash);
    }

    /**
    * @notice Called by a committee to submit a claim for a bounty.
    * The submitted claim needs to be approved or dismissed by the Hats governance.
    * This function should be called only on a safety period, where withdrawals are disabled.
    * Upon a call to this function by the committee the pool withdrawals will be disabled
    * until the Hats governance will approve or dismiss this claim.
    * @param _beneficiary The submitted claim's beneficiary
    * @param _bountyPercentage The submitted claim's bug requested reward percentage
    */
    function submitClaim(address _beneficiary, uint256 _bountyPercentage, string calldata _descriptionHash)
    external
    onlyCommittee()
    noActiveClaim()
    {
        if (_beneficiary == address(0)) revert BeneficiaryIsZero();
        HATVaultsRegistry.GeneralParameters memory generalParameters = registry.getGeneralParameters();
        // require we are in safetyPeriod
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp % (generalParameters.withdrawPeriod + generalParameters.safetyPeriod) <
        generalParameters.withdrawPeriod) revert NotSafetyPeriod();
        if (_bountyPercentage > maxBounty)
            revert BountyPercentageHigherThanMaxBounty();
        uint256 claimId = uint256(keccak256(abi.encodePacked(address(this), block.number, nonce++)));
        claims[claimId] = Claim({
            beneficiary: _beneficiary,
            bountyPercentage: _bountyPercentage,
            committee: msg.sender,
            // solhint-disable-next-line not-rely-on-time
            createdAt: block.timestamp,
            isChallenged: false
        });
        activeClaim = claimId;
        emit SubmitClaim(
            claimId,
            msg.sender,
            _beneficiary,
            _bountyPercentage,
            _descriptionHash
        );
    }

    /**
    * @notice Called by a the arbitrator to challenge a claim
    * This will pause the vault for withdrawals until the claim is resolved
    * @param _claimId The id of the claim
    */

    function challengeClaim(uint256 _claimId) external onlyArbitrator {
        Claim storage claim = claims[_claimId];
        if (claim.beneficiary == address(0))
            revert NoActiveClaimExists();
        if (block.timestamp > claim.createdAt + registry.challengeTimeOutPeriod())
            revert ChallengePeriodEnded();
        claim.isChallenged = true;
    }

    /**
    * @notice Approve a claim for a bounty submitted by a committee, and transfer bounty to hacker and committee.
    * callable by the  arbitrator, if isChallenged == true
    * Callable by anyone after challengePeriod is passed and isChallenged == false
    * @param _claimId The claim ID
    * @param _bountyPercentage The percentage of the vault's balance that will be send as a bounty.
    * The value for _bountyPercentage will be ignored if the caller is not the arbitrator
    */
    function approveClaim(uint256 _claimId, uint256 _bountyPercentage) external nonReentrant {
        Claim storage claim = claims[_claimId];
        if (claim.beneficiary == address(0)) revert NoActiveClaimExists();
        if (claim.isChallenged) {
            if (msg.sender != registry.arbitrator()) revert ClaimCanOnlyBeApprovedAfterChallengePeriodOrByArbitrator();
            claim.bountyPercentage = _bountyPercentage;
        } else {
            if (block.timestamp <= claim.createdAt + registry.challengePeriod()) revert ClaimCanOnlyBeApprovedAfterChallengePeriodOrByArbitrator();
        }

        address tokenLock;

        ClaimBounty memory claimBounty = calcClaimBounty(claim.bountyPercentage);

        balance -=
            claimBounty.hacker +
            claimBounty.hackerVested +
            claimBounty.committee +
            claimBounty.swapAndBurn +
            claimBounty.hackerHatVested +
            claimBounty.governanceHat;

        if (claimBounty.hackerVested > 0) {
            //hacker gets part of bounty to a vesting contract
            tokenLock = tokenLockFactory.createTokenLock(
                address(lpToken),
                0x000000000000000000000000000000000000dEaD, //this address as owner, so it can do nothing.
                claim.beneficiary,
                claimBounty.hackerVested,
                // solhint-disable-next-line not-rely-on-time
                block.timestamp, //start
                // solhint-disable-next-line not-rely-on-time
                block.timestamp + vestingDuration, //end
                vestingPeriods,
                0, //no release start
                0, //no cliff
                ITokenLock.Revocability.Disabled,
                false
            );
            lpToken.safeTransfer(tokenLock, claimBounty.hackerVested);
        }

        lpToken.safeTransfer(claim.beneficiary, claimBounty.hacker);
        lpToken.safeTransfer(claim.committee, claimBounty.committee);
        //storing the amount of token which can be swap and burned so it could be swapAndBurn in a separate tx.
        swapAndBurn += claimBounty.swapAndBurn;
        governanceHatReward += claimBounty.governanceHat;
        hackersHatReward[claim.beneficiary] += claimBounty.hackerHatVested;
        // emit event before deleting the claim object, bcause we want to read beneficiary and bountyPercentage
        emit ApproveClaim(
            _claimId,
            msg.sender,
            claim.beneficiary,
            claim.bountyPercentage,
            tokenLock,
            claimBounty
        );

        delete activeClaim;
        delete claims[_claimId];
    }

    /**
    * @notice Dismiss a claim for a bounty submitted by a committee.
    * Called either by the arbitrator, or by anyone if the claim is over 5 weeks old.
    * @param _claimId The claim ID
    */
    function dismissClaim(uint256 _claimId) external {
        Claim storage claim = claims[_claimId];
        if (!claim.isChallenged) revert OnlyCallableIfChallenged();
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp < claim.createdAt + registry.challengeTimeOutPeriod() && msg.sender != registry.arbitrator())
            revert OnlyCallableByArbitratorOrAfterChallengeTimeOutPeriod();
        delete activeClaim;
        delete claims[_claimId];
        emit DismissClaim(_claimId);
    }


    function calcClaimBounty(uint256 _bountyPercentage)
    public
    view
    returns(ClaimBounty memory claimBounty) {
        uint256 totalSupply = balance;
        if (totalSupply == 0) revert PoolBalanceIsZero();
        if (_bountyPercentage > maxBounty)
            revert BountyPercentageHigherThanMaxBounty();
        uint256 totalBountyAmount = totalSupply * _bountyPercentage;
        claimBounty.hackerVested =
        totalBountyAmount * bountySplit.hackerVested
        / (HUNDRED_PERCENT * HUNDRED_PERCENT);
        claimBounty.hacker =
        totalBountyAmount * bountySplit.hacker
        / (HUNDRED_PERCENT * HUNDRED_PERCENT);
        claimBounty.committee =
        totalBountyAmount * bountySplit.committee
        / (HUNDRED_PERCENT * HUNDRED_PERCENT);
        claimBounty.swapAndBurn =
        totalBountyAmount * bountySplit.swapAndBurn
        / (HUNDRED_PERCENT * HUNDRED_PERCENT);
        claimBounty.governanceHat =
        totalBountyAmount * bountySplit.governanceHat
        / (HUNDRED_PERCENT * HUNDRED_PERCENT);
        claimBounty.hackerHatVested =
        totalBountyAmount * bountySplit.hackerHatVested
        / (HUNDRED_PERCENT * HUNDRED_PERCENT);
    }

    /* -------------------------------------------------------------------------------- */
    
    /* ---------------------------------- Deposit ------------------------------------- */
    
    /**
    * @notice Deposit tokens to the vault
    * Caller must have set an allowance first
    * @param _amount Amount of vault token to deposit.
    **/
    function deposit(uint256 _amount) external nonReentrant {
        if (!committeeCheckedIn)
            revert CommitteeNotCheckedInYet();
        if (poolDepositPause) revert DepositPaused();
        if (!poolInitialized) revert PoolMustBeInitialized();
        
        // clear withdraw request
        withdrawEnableStartTime[msg.sender] = 0;
        uint256 lpSupply = balance;
        uint256 balanceBefore = lpToken.balanceOf(address(this));

        lpToken.safeTransferFrom(msg.sender, address(this), _amount);

        uint256 transferredAmount = lpToken.balanceOf(address(this)) - balanceBefore;

        if (transferredAmount == 0) revert AmountToDepositIsZero();

        balance += transferredAmount;

        // create new shares (and add to the user and the pool's shares) that are the relative part of the user's new deposit
        // out of the pool's total supply, relative to the previous total shares in the pool
        uint256 addedUserShares;
        if (totalShares == 0) {
            addedUserShares = transferredAmount;
        } else {
            addedUserShares = totalShares * transferredAmount / lpSupply;
        }

        rewardController.updateRewardPool(msg.sender, addedUserShares, true, true);

        userShares[msg.sender] += addedUserShares;
        totalShares += addedUserShares;

        emit Deposit(msg.sender, _amount, transferredAmount);
    }

    /* -------------------------------------------------------------------------------- */
    
    /* ---------------------------------- Params -------------------------------------- */

    /**
    * @notice Set new committee address. Can be called by existing committee if it had checked in, or
    * by the governance otherwise.
    * @param _committee new committee address
    */
    function setCommittee(address _committee)
    external {
        if (_committee == address(0)) revert CommitteeIsZero();
        // governance can update committee only if committee was not checked in yet.
        if (msg.sender == owner() && committee != msg.sender) {
            if (committeeCheckedIn)
                revert CommitteeAlreadyCheckedIn();
        } else {
            if (committee != msg.sender) revert OnlyCommittee();
        }

        committee = _committee;

        emit SetCommittee(_committee);
    }

    /**
    * @notice setVestingParams - set the vesting params for rewarding a claim reporter with the vault token
    * @param _duration duration of the vesting period
    * @param _periods the vesting periods
    */
    function setVestingParams(uint256 _duration, uint256 _periods) external onlyOwner {
        if (_duration >= 120 days) revert VestingDurationTooLong();
        if (_periods == 0) revert VestingPeriodsCannotBeZero();
        if (_duration < _periods) revert VestingDurationSmallerThanPeriods();
        vestingDuration = _duration;
        vestingPeriods = _periods;
        emit SetVestingParams(_duration, _periods);
    }

    /**
    * @notice Set the vault token bounty split upon an approval
    * The function can be called only by governance.
    * @param _bountySplit The bounty split
    */
    function setBountySplit(BountySplit memory _bountySplit)
    external
    onlyOwner noActiveClaim noSafetyPeriod {
        validateSplit(_bountySplit);
        bountySplit = _bountySplit;
        emit SetBountySplit(_bountySplit);
    }

    function setPoolWithdrawalFee(uint256 _newFee) external onlyFeeSetter {
        if (_newFee > MAX_FEE) revert PoolWithdrawalFeeTooBig();
        withdrawalFee = _newFee;
        emit SetPoolWithdrawalFee(_newFee);
    }

    /**
    * @notice committeeCheckIn - committee check in.
    * deposit is enable only after committee check in
    */
    function committeeCheckIn() external onlyCommittee {
        committeeCheckedIn = true;
        emit CommitteeCheckedIn();
    }

    /**
    * @notice Set pending request to set pool max bounty.
    * The function can be called only by the pool committee.
    * Cannot be called if there are claims that have been submitted.
    * Max bounty should be less than or equal to `HUNDRED_PERCENT`
    * @param _maxBounty The maximum bounty percentage that can be paid out
    */
    function setPendingMaxBounty(uint256 _maxBounty)
    external
    onlyCommittee noActiveClaim {
        if (_maxBounty > HUNDRED_PERCENT)
            revert MaxBountyCannotBeMoreThanHundredPercent();
        pendingMaxBounty.maxBounty = _maxBounty;
        // solhint-disable-next-line not-rely-on-time
        pendingMaxBounty.timestamp = block.timestamp;
        emit SetPendingMaxBounty(_maxBounty, pendingMaxBounty.timestamp);
    }

    /**
    * @notice Set the pool max bounty to the already pending max bounty.
    * The function can be called only by the pool committee.
    * Cannot be called if there are claims that have been submitted.
    * Can only be called if there is a max bounty pending approval, and the time delay since setting the pending max bounty
    * had passed.
    * Max bounty should be less than `HUNDRED_PERCENT`
    */
    function setMaxBounty() external onlyCommittee noActiveClaim {
        if (pendingMaxBounty.timestamp == 0) revert NoPendingMaxBounty();

        HATVaultsRegistry.GeneralParameters memory generalParameters = registry.getGeneralParameters();

        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp - pendingMaxBounty.timestamp <
            generalParameters.setMaxBountyDelay)
            revert DelayPeriodForSettingMaxBountyHadNotPassed();
        maxBounty = pendingMaxBounty.maxBounty;
        delete pendingMaxBounty;
        emit SetMaxBounty(maxBounty);
    }

    function setRewardController(IRewardController _newRewardController) public onlyOwner {
        rewardController = _newRewardController;
        emit SetRewardController(_newRewardController);
    }

    /* -------------------------------------------------------------------------------- */

    /* ----------------------------------- Pool --------------------------------------- */

    // TODO: Update this function name (maybe split it up)
    /**
    * @notice change the information for a pool
    * ony calleable by the owner of the contract
    * @param _visible is this pool visible in the UI
    * @param _depositPause pause pool deposit (default false).
    * This parameter can be used by the UI to include or exclude the pool
    * @param _descriptionHash the hash of the pool description.
    */
    function setPool(
        bool _visible,
        bool _depositPause,
        string memory _descriptionHash
    ) external onlyOwner {
        poolDepositPause = _depositPause;

        emit SetPool(_visible, _depositPause, _descriptionHash);
    }

    /**
    * @notice set the flag that the pool is initialized to true
    * ony calleable by the owner of the contract
    */
    function setPoolInitialized() external onlyOwner {
        poolInitialized = true;
    }

    /**
    * @notice set the shares of users in a pool
    * only calleable by the owner, and only when a pool is not initialized
    * This function is used for migrating older pool data to this new contract
    */
    function setShares(
        uint256 _rewardPerShare,
        uint256 _balance,
        address[] memory _accounts,
        uint256[] memory _shares,
        uint256[] memory _rewardDebts)
    external onlyOwner {
        if (poolInitialized) revert PoolMustNotBeInitialized();
        if (_accounts.length != _shares.length ||
            _accounts.length != _rewardDebts.length)
            revert SetSharesArraysMustHaveSameLength();

        balance = _balance;

        for (uint256 i = 0; i < _accounts.length; i++) {
            userShares[_accounts[i]] = _shares[i];
            totalShares += _shares[i];
        }

        rewardController.setShares(_rewardPerShare, _accounts, _rewardDebts);
    }

    /* -------------------------------------------------------------------------------- */

    /* ----------------------------------- Swap --------------------------------------- */

    /**
    * @notice Swap pool's token to swapToken.
    * Send to beneficiary and governance their HATs rewards.
    * Burn the rest of swapToken.
    * Only governance is authorized to call this function.
    * @param _beneficiary beneficiary
    * @param _amountOutMinimum minimum output of swapToken at swap
    * @param _routingContract routing contract to call for the swap
    * @param _routingPayload payload to send to the _routingContract for the swap
    **/
    function swapBurnSend(
        address _beneficiary,
        uint256 _amountOutMinimum,
        address _routingContract,
        bytes calldata _routingPayload
    ) external onlyOwner {
        uint256 amount = swapAndBurn + hackersHatReward[_beneficiary] + governanceHatReward;
        if (amount == 0) revert AmountToSwapIsZero();
        ERC20Burnable _swapToken = swapToken;
        uint256 hatsReceived = swapTokenForHAT(amount, _amountOutMinimum, _routingContract, _routingPayload);
        uint256 burntHats = hatsReceived * swapAndBurn / amount;
        if (burntHats > 0) {
            _swapToken.burn(burntHats);
        }
        emit SwapAndBurn(amount, burntHats);

        address tokenLock;
        uint256 hackerReward = hatsReceived * hackersHatReward[_beneficiary] / amount;
        swapAndBurn = 0;
        governanceHatReward = 0;
        hackersHatReward[_beneficiary] = 0;
        if (hackerReward > 0) {
            HATVaultsRegistry.GeneralParameters memory generalParameters = registry.getGeneralParameters();
            // hacker gets her reward via vesting contract
            tokenLock = tokenLockFactory.createTokenLock(
                address(_swapToken),
                0x000000000000000000000000000000000000dEaD, //this address as owner, so it can do nothing.
                _beneficiary,
                hackerReward,
                // solhint-disable-next-line not-rely-on-time
                block.timestamp, //start
                // solhint-disable-next-line not-rely-on-time
                block.timestamp + generalParameters.hatVestingDuration, //end
                generalParameters.hatVestingPeriods,
                0, // no release start
                0, // no cliff
                ITokenLock.Revocability.Disabled,
                true
            );
            _swapToken.safeTransfer(tokenLock, hackerReward);
        }
        emit SwapAndSend(_beneficiary, amount, hackerReward, tokenLock);
        _swapToken.safeTransfer(owner(), hatsReceived - hackerReward - burntHats);
    }

    function swapTokenForHAT(uint256 _amount,
        uint256 _amountOutMinimum,
        address _routingContract,
        bytes calldata _routingPayload)
    internal
    returns (uint256 swapTokenReceived)
    {
        IERC20 token = lpToken;
        ERC20Burnable _swapToken = swapToken;
        if (address(token) == address(_swapToken)) {
            return _amount;
        }
        if (!registry.whitelistedRouters(_routingContract))
            revert RoutingContractNotWhitelisted();
        if (!token.approve(_routingContract, _amount))
            revert TokenApproveFailed();
        uint256 balanceBefore = _swapToken.balanceOf(address(this));

        // solhint-disable-next-line avoid-low-level-calls
        (bool success,) = _routingContract.call(_routingPayload);
        if (!success) revert SwapFailed();
        swapTokenReceived = _swapToken.balanceOf(address(this)) - balanceBefore;
        if (swapTokenReceived < _amountOutMinimum)
            revert AmountSwappedLessThanMinimum();
            
        if (!token.approve(address(_routingContract), 0))
            revert TokenApproveResetFailed();
    }

    /* -------------------------------------------------------------------------------- */

    /* --------------------------------- Withdraw ------------------------------------- */

    /**
    * @notice Submit a request to withdraw funds from the vault.
    * The request will only be approved if the last action was a deposit or withdrawal or in case the last action was a withdraw request,
    * that the pending period (of `generalParameters.withdrawRequestPendingPeriod`) had ended and the withdraw enable period (of `generalParameters.withdrawRequestEnablePeriod`)
    * had also ended.
    **/
    function withdrawRequest() external nonReentrant {
        HATVaultsRegistry.GeneralParameters memory generalParameters = registry.getGeneralParameters();
        // require withdraw to be at least withdrawRequestEnablePeriod+withdrawRequestPendingPeriod since last withdrawwithdrawRequest
        // unless there's been a deposit or withdraw since, in which case withdrawRequest is allowed immediately
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp <
            withdrawEnableStartTime[msg.sender] +
                generalParameters.withdrawRequestEnablePeriod)
            revert PendingWithdrawRequestExists();
        // set the withdrawRequests time to be withdrawRequestPendingPeriod from now
        // solhint-disable-next-line not-rely-on-time
        withdrawEnableStartTime[msg.sender] = block.timestamp + generalParameters.withdrawRequestPendingPeriod;
        emit WithdrawRequest(msg.sender, withdrawEnableStartTime[msg.sender]);
    }

    /**
    * @notice Withdraw user's requested share from the vault.
    * The withdrawal will only take place if the user has submitted a withdraw request, and the pending period of
    * `generalParameters.withdrawRequestPendingPeriod` had passed since then, and we are within the period where
    * withdrawal is enabled, meaning `generalParameters.withdrawRequestEnablePeriod` had not passed since the pending period
    * had finished.
    * @param _shares Amount of shares user wants to withdraw
    **/
    function withdraw(uint256 _shares) external nonReentrant {
        checkWithdrawAndResetWithdrawEnableStartTime();

        if (userShares[msg.sender] < _shares) revert NotEnoughUserBalance();

        rewardController.updateRewardPool(msg.sender, _shares, false, true);

        if (_shares > 0) {
            userShares[msg.sender] -= _shares;
            uint256 amountToWithdraw = (_shares * balance) / totalShares;
            uint256 fee = amountToWithdraw * withdrawalFee / HUNDRED_PERCENT;
            balance -= amountToWithdraw;
            totalShares -= _shares;
            safeWithdrawPoolToken(lpToken, amountToWithdraw, fee);
        }

        emit Withdraw(msg.sender, _shares);
    }

    /**
    * @notice Withdraw all user's shares without claim for reward.
    * The withdrawal will only take place if the user has submitted a withdraw request, and the pending period of
    * `generalParameters.withdrawRequestPendingPeriod` had passed since then, and we are within the period where
    * withdrawal is enabled, meaning `generalParameters.withdrawRequestEnablePeriod` had not passed since the pending period
    * had finished.
    **/
    function emergencyWithdraw() external nonReentrant {
        checkWithdrawAndResetWithdrawEnableStartTime();

        uint256 currentUserShares = userShares[msg.sender];
        if (currentUserShares == 0) revert UserSharesMustBeGreaterThanZero();

        rewardController.updateRewardPool(msg.sender, currentUserShares, false, false);

        uint256 factoredBalance = (currentUserShares * balance) / totalShares;
        uint256 fee = (factoredBalance * withdrawalFee) / HUNDRED_PERCENT;

        totalShares -= currentUserShares;
        balance -= factoredBalance;
        userShares[msg.sender] = 0;
        
        safeWithdrawPoolToken(lpToken, factoredBalance, fee);

        emit EmergencyWithdraw(msg.sender, factoredBalance);
    }

    // @notice Checks that the sender can perform a withdraw at this time
    // and also sets the withdrawRequest to 0
    function checkWithdrawAndResetWithdrawEnableStartTime()
        internal
        noActiveClaim
        noSafetyPeriod
    {
        HATVaultsRegistry.GeneralParameters memory generalParameters = registry.getGeneralParameters();
        // check that withdrawRequestPendingPeriod had passed
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp < withdrawEnableStartTime[msg.sender] ||
        // check that withdrawRequestEnablePeriod had not passed and that the
        // last action was withdrawRequest (and not deposit or withdraw, which
        // reset withdrawRequests[_pid][msg.sender] to 0)
        // solhint-disable-next-line not-rely-on-time
            block.timestamp >
                withdrawEnableStartTime[msg.sender] +
                generalParameters.withdrawRequestEnablePeriod)
            revert InvalidWithdrawRequest();
        // if all is ok and withdrawal can be made - reset withdrawRequests[_pid][msg.sender] so that another withdrawRequest
        // will have to be made before next withdrawal
        withdrawEnableStartTime[msg.sender] = 0;
    }

    function safeWithdrawPoolToken(IERC20 _lpToken, uint256 _totalAmount, uint256 _fee)
        internal
    {
        if (_fee > 0) {
            _lpToken.safeTransfer(owner(), _fee);
        }
        _lpToken.safeTransfer(msg.sender, _totalAmount - _fee);
    }

    /* -------------------------------------------------------------------------------- */
}