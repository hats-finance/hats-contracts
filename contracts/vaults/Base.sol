// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.16;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../tokenlock/TokenLockFactory.sol";
import "../interfaces/IRewardController.sol";
import "../HATVaultsRegistry.sol";


// Errors:
// Only committee
error OnlyCommittee();
// Active claim exists
error ActiveClaimExists();
// Safety period
error SafetyPeriod();
// Not safety period
error NotSafetyPeriod();
// Bounty percentage is higher than the max bounty
error BountyPercentageHigherThanMaxBounty();
// Only callable by arbitrator or after challenge timeout period
error OnlyCallableByArbitratorOrAfterChallengeTimeOutPeriod();
// No active claim exists
error NoActiveClaimExists();
// Claim Id specified is not the active claim Id
error WrongClaimId();
// Not enough fee paid
error NotEnoughFeePaid();
// No pending max bounty
error NoPendingMaxBounty();
// Delay period for setting max bounty had not passed
error DelayPeriodForSettingMaxBountyHadNotPassed();
// Committee already checked in
error CommitteeAlreadyCheckedIn();
// Pending withdraw request exists
error PendingWithdrawRequestExists();
// Amount to deposit is zero
error AmountToDepositIsZero();
// Vault balance is zero
error VaultBalanceIsZero();
// Total bounty split % should be `HUNDRED_PERCENT`
error TotalSplitPercentageShouldBeHundredPercent();
// Withdraw request is invalid
error InvalidWithdrawRequest();
// Max bounty cannot be more than `MAX_BOUNTY_LIMIT`
error MaxBountyCannotBeMoreThanMaxBountyLimit();
// Only fee setter
error OnlyFeeSetter();
// Fee must be less than or equal to 2%
error WithdrawalFeeTooBig();
// Set shares arrays must have same length
error SetSharesArraysMustHaveSameLength();
// Committee not checked in yet
error CommitteeNotCheckedInYet();
// Not enough user balance
error NotEnoughUserBalance();
// Only arbitrator
error OnlyArbitrator();
// Unchalleged claim can only be approved if challenge period is over
error UnchallengedClaimCanOnlyBeApprovedAfterChallengePeriod();
// Challenged claim can only be approved by arbitrator before the challenge timeout period
error ChallengedClaimCanOnlyBeApprovedByArbitratorUntilChallengeTimeoutPeriod();
error ChallengePeriodEnded();
// Only callable if challenged
error OnlyCallableIfChallenged();
// Cannot deposit to another user with withdraw request
error CannotDepositToAnotherUserWithWithdrawRequest();
// Withdraw amount must be greater than zero
error WithdrawMustBeGreaterThanZero();
// Withdraw amount cannot be more than maximum for user
error WithdrawMoreThanMax();
// Redeem amount cannot be more than maximum for user
error RedeemMoreThanMax();

contract Base is ERC4626Upgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    // How to divide the bounties of the vault, in percentages (out of `HUNDRED_PERCENT`)
    // The precentages are out of what is left after deducting the HATVaultsRegistry.HATBountySplit
    struct BountySplit {
        //the percentage of the total bounty to reward the hacker via vesting contract
        uint256 hackerVested;
        //the percentage of the total bounty to reward the hacker
        uint256 hacker;
        // the percentage of the total bounty to be sent to the committee
        uint256 committee;
    }

    // How to divide a bounty for a claim that has been approved, in amounts
    // of the vault's native token
    struct ClaimBounty {
        uint256 hacker;
        uint256 hackerVested;
        uint256 committee;
        uint256 hackerHatVested;
        uint256 governanceHat;
    }

    struct Claim {
        bytes32 claimId;
        address beneficiary;
        uint256 bountyPercentage;
        // the address of the committee at the time of the submittal, so that this committee will
        // be paid their share of the bounty in case the committee changes before claim approval
        address committee;
        uint256 createdAt;
        uint256 challengedAt;
    }

    struct PendingMaxBounty {
        uint256 maxBounty;
        uint256 timestamp;
    }

    uint256 public constant HUNDRED_PERCENT = 10000;
    uint256 public constant MAX_BOUNTY_LIMIT = 9000; // Max bounty can be up to 90%
    uint256 public constant HUNDRED_PERCENT_SQRD = 100000000;
    uint256 public constant MAX_FEE = 200; // Max fee is 2%

    HATVaultsRegistry public registry;
    ITokenLockFactory public tokenLockFactory;

    Claim public activeClaim;

    IRewardController public rewardController;

    BountySplit public bountySplit;
    uint256 public maxBounty;
    uint256 public vestingDuration;
    uint256 public vestingPeriods;

    bool public committeeCheckedIn;
    uint256 public withdrawalFee;

    uint256 internal nonce;

    address public committee;

    PendingMaxBounty public pendingMaxBounty;

    bool public depositPause;

    mapping(address => uint256) public withdrawEnableStartTime;
    
    event LogClaim(address indexed _claimer, string _descriptionHash);
    event SubmitClaim(
        bytes32 indexed _claimId,
        address indexed _committee,
        address indexed _beneficiary,
        uint256 _bountyPercentage,
        string _descriptionHash
    );
    event ChallengeClaim(bytes32 indexed _claimId);
    event ApproveClaim(
        bytes32 indexed _claimId,
        address indexed _committee,
        address indexed _beneficiary,
        uint256 _bountyPercentage,
        address _tokenLock,
        ClaimBounty _claimBounty
    );
    event DismissClaim(bytes32 indexed _claimId);
    event SetCommittee(address indexed _committee);
    event SetVestingParams(
        uint256 _duration,
        uint256 _periods
    );
    event SetBountySplit(BountySplit _bountySplit);
    event SetWithdrawalFee(uint256 _newFee);
    event CommitteeCheckedIn();
    event SetPendingMaxBounty(uint256 _maxBounty, uint256 _timeStamp);
    event SetMaxBounty(uint256 _maxBounty);
    event SetRewardController(IRewardController indexed _newRewardController);
    event SetDepositPause(bool _depositPause);
    event SetVaultDescription(string _descriptionHash);

    event WithdrawRequest(
        address indexed _beneficiary,
        uint256 _withdrawEnableTime
    );

    modifier onlyFeeSetter() {
        if (registry.feeSetter() != msg.sender) revert OnlyFeeSetter();
        _;
    }

    modifier onlyCommittee() {
        if (committee != msg.sender) revert OnlyCommittee();
        _;
    }

    modifier onlyArbitrator() {
        if (registry.getArbitrator(address(this)) != msg.sender) revert OnlyArbitrator();
        _;
    }

    modifier noSafetyPeriod() {
        HATVaultsRegistry.GeneralParameters memory generalParameters = registry.getGeneralParameters();
        // disable withdraw for safetyPeriod (e.g 1 hour) after each withdrawPeriod(e.g 11 hours)
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp %
        (generalParameters.withdrawPeriod + generalParameters.safetyPeriod) >=
            generalParameters.withdrawPeriod) revert SafetyPeriod();
        _;
    }

    modifier noActiveClaim() {
        if (activeClaim.createdAt != 0) revert ActiveClaimExists();
        _;
    }

    modifier isActiveClaim(bytes32 _claimId) {
        if (activeClaim.createdAt == 0) revert NoActiveClaimExists();
        if (activeClaim.claimId != _claimId) revert WrongClaimId();
        _;
    }

    /** 
    * @dev Check that a given bounty split is legal, meaning that:
    *   Each entry is a number between 0 and `HUNDRED_PERCENT`.
    *   Total splits should be equal to `HUNDRED_PERCENT`.
    * function will revert in case the bounty split is not legal.
    * @param _bountySplit The bounty split to check
    */
    function validateSplit(BountySplit memory _bountySplit) internal pure {
        if (_bountySplit.hackerVested +
            _bountySplit.hacker +
            _bountySplit.committee != HUNDRED_PERCENT)
            revert TotalSplitPercentageShouldBeHundredPercent();
    }
}