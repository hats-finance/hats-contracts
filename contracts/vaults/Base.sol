// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.14;

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
// Max bounty cannot be more than `HUNDRED_PERCENT`
error MaxBountyCannotBeMoreThanHundredPercent();
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
// Claim can only be approved if challenge period is over, or if the
// caller is the arbitrator
error ClaimCanOnlyBeApprovedAfterChallengePeriodOrByArbitrator();
// Bounty split must include hacker payout
error BountySplitMustIncludeHackerPayout();
error ChallengePeriodEnded();
error OnlyCallableIfChallenged();
error CannotDepositToAnotherUserWithWithdrawRequest();
error WithdrawMustBeGreaterThanZero();
error WithdrawMoreThanMax();
error RedeemMoreThanMax();

contract Base is ERC4626Upgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    // How to divide the bounties of the vault, in percentages (out of `HUNDRED_PERCENT`)
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

    // How to divide a bounty for a claim that has been approved, in amounts of the vault's token
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
        address indexed _committee,
        address indexed _beneficiary,
        uint256 _bountyPercentage,
        string _descriptionHash
    );
    event ApproveClaim(
        address indexed _committee,
        address indexed _beneficiary,
        uint256 _bountyPercentage,
        address _tokenLock,
        ClaimBounty _claimBounty
    );
    event DismissClaim();
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
    event UpdateVaultInfo(
        bool indexed _registered,
        bool _depositPause,
        string _descriptionHash
    );

    event WithdrawRequest(
        address indexed _beneficiary,
        uint256 _withdrawEnableTime
    );
    event EmergencyWithdraw(address indexed user, uint256 assets, uint256 shares);

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

    modifier activeClaimExists() {
        if (activeClaim.createdAt == 0) revert NoActiveClaimExists();
        _;
    }

    /**
    * @notice change the information of the vault
    * ony calleable by the owner of the contract
    * @param _visible is this vault visible in the UI
    * @param _depositPause pause deposits (default false).
    * This parameter can be used by the UI to include or exclude the vault
    * @param _descriptionHash the hash of the vault's description.
    */
    function updateVaultInfo(
        bool _visible,
        bool _depositPause,
        string memory _descriptionHash
    ) external onlyOwner {
        depositPause = _depositPause;

        emit UpdateVaultInfo(_visible, _depositPause, _descriptionHash);
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
}