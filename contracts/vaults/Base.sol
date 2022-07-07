// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.14;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "../tokenlock/TokenLockFactory.sol";
import "../interfaces/IRewardController.sol";

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
// Withdraw request pending period must be <= 3 months
error WithdrawRequestPendingPeriodTooLong();
// Withdraw request enabled period must be >= 6 hour
error WithdrawRequestEnabledPeriodTooShort();
// Only callable by arbitrator or after challenge timeout period
error OnlyCallableByArbitratorOrAfterChallengeTimeOutPeriod();
// No active claim exists
error NoActiveClaimExists();
// Withdraw period must be >= 1 hour
error WithdrawPeriodTooShort();
// Safety period must be <= 6 hours
error SafetyPeriodTooLong();
// Not enough fee paid
error NotEnoughFeePaid();
// Vesting duration is too long
error VestingDurationTooLong();
// Vesting periods cannot be zero
error VestingPeriodsCannotBeZero();
// Vesting duration smaller than periods
error VestingDurationSmallerThanPeriods();
// Delay is too short
error DelayTooShort();
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


contract Base is OwnableUpgradeable, ReentrancyGuardUpgradeable {
    // Parameters that apply to all the vaults
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using SafeERC20Upgradeable for ERC20BurnableUpgradeable;
    
    struct GeneralParameters {
        uint256 hatVestingDuration;
        uint256 hatVestingPeriods;
        // withdraw enable period. safetyPeriod starts when finished.
        uint256 withdrawPeriod;
        // withdraw disable period - time for the committee to gather and decide on actions,
        // withdrawals are not possible in this time. withdrawPeriod starts when finished.
        uint256 safetyPeriod;
        // period of time after withdrawRequestPendingPeriod where it is possible to withdraw
        // (after which withdrawal is not possible)
        uint256 withdrawRequestEnablePeriod;
        // period of time that has to pass after withdraw request until withdraw is possible
        uint256 withdrawRequestPendingPeriod;
        uint256 setMaxBountyDelay;
        uint256 claimFee;  //claim fee in ETH
    }

    // Info of each pool.
    struct PoolInfo {
        bool committeeCheckedIn;
        IERC20Upgradeable lpToken;
        // total amount of LP tokens in pool
        uint256 balance;
        uint256 totalShares;
        // fee to take from withdrawals to governance
        uint256 withdrawalFee;
        
        IRewardController rewardController;
    }

    // Info of each pool's bounty policy.
    struct BountyInfo {
        BountySplit bountySplit;
        uint256 maxBounty;
        uint256 vestingDuration;
        uint256 vestingPeriods;
    }

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

    // Info of a claim for a bounty payout that has been submitted by a committee
    struct Claim {
        uint256 pid;
        address beneficiary;
        uint256 bountyPercentage;
        // the address of the committee at the time of the submittal, so that this committee will
        // be payed their share of the bounty in case the committee changes before claim approval
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

    // PARAMETERS FOR ALL VAULTS
    // time during which a claim can be challenged by the arbitrator
    uint256 public challengePeriod;
    // time after which a challenged claim is automatically dismissed
    uint256 public challengeTimeOutPeriod;
    // a struct with parameters for all vaults
    GeneralParameters public generalParameters;
    // rewardController determines how many rewards each pool gets in the incentive program
    ITokenLockFactory public tokenLockFactory;
    // feeSetter sets the withdrawal fee
    address public feeSetter;
    // address of the arbitrator - which can dispute claims and override the committee's decisions
    address public arbitrator;
    // the token into which a part of the the bounty will be swapped-into-and-burnt - this will
    // typically be HATs
    ERC20BurnableUpgradeable public swapToken;
    mapping(address => bool) public whitelistedRouters;
    uint256 internal nonce;

    // PARAMETERS PER VAULT
    PoolInfo[] public poolInfos;
    // Info of each pool.
    // poolId -> committee address
    mapping(uint256 => address) public committees;
    // Info of each user that stakes LP tokens. poolId => user address => shares
    mapping(uint256 => mapping(address => uint256)) public userShares;
    // poolId -> BountyInfo
    mapping(uint256 => BountyInfo) public bountyInfos;
    // poolId -> PendingMaxBounty
    mapping(uint256 => PendingMaxBounty) public pendingMaxBounty;
    // poolId -> claimId
    mapping(uint256 => uint256) public activeClaims;
    // poolId -> isPoolInitialized
    mapping(uint256 => bool) public poolInitialized;
    // poolID -> isPoolPausedForDeposit
    mapping(uint256 => bool) public poolDepositPause;
    // Time of when last withdraw request pending period ended, or 0 if last action was deposit or withdraw
    // poolId -> (address -> requestTime)
    mapping(uint256 => mapping(address => uint256)) public withdrawEnableStartTime;

    // PARAMETERS PER CLAIM
    // claimId -> Claim
    mapping(uint256 => Claim) public claims;
    // poolId -> amount
    mapping(uint256 => uint256) public swapAndBurns;
    // hackerAddress -> (pid -> amount)
    mapping(address => mapping(uint256 => uint256)) public hackersHatRewards;
    // poolId -> amount
    mapping(uint256 => uint256) public governanceHatRewards;

    event LogClaim(address indexed _claimer, string _descriptionHash);
    event SubmitClaim(
        uint256 indexed _pid,
        uint256 _claimId,
        address _committee,
        address indexed _beneficiary,
        uint256 indexed _bountyPercentage,
        string _descriptionHash
    );
    event ApproveClaim(
        uint256 indexed _pid,
        uint256 indexed _claimId,
        address indexed _committee,
        address _beneficiary,
        uint256 _bountyPercentage,
        address _tokenLock,
        ClaimBounty _claimBounty
    );
    event DismissClaim(uint256 indexed _pid, uint256 indexed _claimId);
    event Deposit(address indexed user,
        uint256 indexed pid,
        uint256 amount,
        uint256 transferredAmount
    );
    event SetFeeSetter(address indexed _newFeeSetter);
    event SetCommittee(uint256 indexed _pid, address indexed _committee);
    event SetChallengePeriod(uint256 _challengePeriod);
    event SetChallengeTimeOutPeriod(uint256 _challengeTimeOutPeriod);
    event SetArbitrator(address indexed _arbitrator);
    event SetWithdrawRequestParams(
        uint256 indexed _withdrawRequestPendingPeriod,
        uint256 indexed _withdrawRequestEnablePeriod
    );
    event SetClaimFee(uint256 _fee);
    event SetWithdrawSafetyPeriod(uint256 indexed _withdrawPeriod, uint256 indexed _safetyPeriod);
    event SetVestingParams(
        uint256 indexed _pid,
        uint256 indexed _duration,
        uint256 indexed _periods
    );
    event SetHatVestingParams(uint256 indexed _duration, uint256 indexed _periods);
    event SetBountySplit(uint256 indexed _pid, BountySplit _bountySplit);
    event SetMaxBountyDelay(uint256 indexed _delay);
    event RouterWhitelistStatusChanged(address indexed _router, bool _status);
    event SetPoolWithdrawalFee(uint256 indexed _pid, uint256 _newFee);
    event CommitteeCheckedIn(uint256 indexed _pid);
    event SetPendingMaxBounty(uint256 indexed _pid, uint256 _maxBounty, uint256 _timeStamp);
    event SetMaxBounty(uint256 indexed _pid, uint256 _maxBounty);
    event SetRewardController(uint256 indexed _pid, IRewardController indexed _newRewardController);
    event AddPool(
        uint256 indexed _pid,
        address indexed _lpToken,
        address _committee,
        IRewardController _rewardController,
        string _descriptionHash,
        uint256 _maxBounty,
        BountySplit _bountySplit,
        uint256 _bountyVestingDuration,
        uint256 _bountyVestingPeriods
    );
    event SetPool(
        uint256 indexed _pid,
        bool indexed _registered,
        bool _depositPause,
        string _descriptionHash
    );
    event SwapAndBurn(
        uint256 indexed _pid,
        uint256 indexed _amountSwapped,
        uint256 indexed _amountBurned
    );
    event SwapAndSend(
        uint256 indexed _pid,
        address indexed _beneficiary,
        uint256 indexed _amountSwapped,
        uint256 _amountReceived,
        address _tokenLock
    );
    event WithdrawRequest(
        uint256 indexed _pid,
        address indexed _beneficiary,
        uint256 indexed _withdrawEnableTime
    );
    event Withdraw(address indexed user, uint256 indexed pid, uint256 shares);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);

    modifier onlyFeeSetter() {
        if (feeSetter != msg.sender) revert OnlyFeeSetter();
        _;
    }

    modifier onlyCommittee(uint256 _pid) {
        if (committees[_pid] != msg.sender) revert OnlyCommittee();
        _;
    }

    modifier onlyArbitrator() {
        if (arbitrator != msg.sender) revert OnlyArbitrator();
        _;
    }

    modifier noSafetyPeriod() {
        //disable withdraw for safetyPeriod (e.g 1 hour) after each withdrawPeriod(e.g 11 hours)
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp %
        (generalParameters.withdrawPeriod + generalParameters.safetyPeriod) >=
            generalParameters.withdrawPeriod) revert SafetyPeriod();
        _;
    }

    modifier noActiveClaims(uint256 _pid) {
        if (activeClaims[_pid] != 0) revert ActiveClaimExists();
        _;
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

    /**
     * @notice This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
