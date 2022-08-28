// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.16;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
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
// Not safety period
error NotSafetyPeriod();
// Bounty percentage is higher than the max bounty
error BountyPercentageHigherThanMaxBounty();
// Only callable by arbitrator or after challenge timeout period
error OnlyCallableByArbitratorOrAfterChallengeTimeOutPeriod();
// No active claim exists
error NoActiveClaimExists();
// Claim Id specified is not the active claim Id
error ClaimIdIsNotActive();
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
// Total bounty split % should be `HUNDRED_PERCENT`
error TotalSplitPercentageShouldBeHundredPercent();
// Withdraw request is invalid
error InvalidWithdrawRequest();
// Max bounty cannot be more than `MAX_BOUNTY_LIMIT`
error MaxBountyCannotBeMoreThanMaxBountyLimit();
// Only registry owner
error OnlyRegistryOwner();
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
// Claim has expired
error ClaimExpired();
error ChallengePeriodEnded();
// claim can be challenged only once
error ClaimAlreadyChallenged();
// Only callable if challenged
error OnlyCallableIfChallenged();
// Cannot deposit to another user with withdraw request
error CannotTransferToAnotherUserWithActiveWithdrawRequest();
// Withdraw amount must be greater than zero
error WithdrawMustBeGreaterThanZero();
// Withdraw amount cannot be more than maximum for user
error WithdrawMoreThanMax();
// Redeem amount cannot be more than maximum for user
error RedeemMoreThanMax();
// System is in an emergency pause
error SystemInEmergencyPause();

/** @title A HAT vault which holds the funds for a specific project's bug 
* bounties
* @author hats.finance
* @notice The HAT vault can be deposited into in a permissionless maner using
* the vault’s native token. When a bug is submitted and approved, the bounty 
* is paid out using the funds in the vault. Bounties are paid out as a
* percentage of the vault. The percentage is set according to the severity of
* the bug. Vaults have regular safety periods (typically for an hour twice a
* day) which are time for the committee to make decisions.
*
* In addition to the roles defined in the HATVaultsRegistry, every HATVault 
* has the roles:
* Committee - The only address which can submit a claim for a bounty payout
* and set the maximum bounty.
* User - Anyone can deposit the vault's native token into the vault and 
* recieve shares for it. Shares represent the user's relative part in the
* vault, and when a bounty is paid out, users lose part of their deposits
* (based on percentage paid), but keep their share of the vault.
* Users also receive rewards for their deposits, which can be claimed at any
* time.
* To withdraw previously deposited tokens, a user must first send a withdraw
* request, and the withdrawal will be made available after a pending period.
* Withdrawals are not permitted during safety periods or while there is an 
* active claim for a bounty payout.
*
* Bounties are payed out distributed between a few channels, and that 
* distribution is set upon creation (the hacker gets part in direct transfer,
* part in vested reward and part in vested HAT token, part gets rewarded to
* the committee, part gets swapped to HAT token and burned and/or sent to Hats
* governance).
*
* This project is open-source and can be found at:
* https://github.com/hats-finance/hats-contracts
*
* @dev HATVault implements the ERC4626 standard
*/
contract HATVault is ERC4626Upgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    // How to divide the bounty - after deducting HATVaultsRegistry.HATBountySplit
    // values are in percentages and should add up to `HUNDRED_PERCENT`
    struct BountySplit {
        // the percentage of reward sent to the hacker via vesting contract
        uint256 hackerVested;
        // the percentage of tokens that are sent directly to the hacker
        uint256 hacker;
        // the percentage sent to the committee
        uint256 committee;
    }

    // How to divide a bounty for a claim that has been approved
    // used internally to keep track of payouts
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
        // the address of the committee at the time of the submission, so that this committee will
        // be paid their share of the bounty in case the committee changes before claim approval
        address committee;
        uint256 createdAt;
        uint256 challengedAt;
    }

    struct PendingMaxBounty {
        uint256 maxBounty;
        uint256 timestamp;
    }
    
    /**
    * @param rewardController The reward controller for the vault
    * @param vestingDuration Duration of the vesting period of the vault's
    * token vested part of the bounty
    * @param vestingPeriods The number of vesting periods of the vault's token
    * vested part of the bounty
    * @param maxBounty The maximum percentage of the vault that can be paid
    * out as a bounty
    * @param bountySplit The way to split the bounty between the hacker, 
    * hacker vested, and committee.
    *   Each entry is a number between 0 and `HUNDRED_PERCENT`.
    *   Total splits should be equal to `HUNDRED_PERCENT`.
    * @param asset The vault's native token
    * @param owner The address of the vault's owner 
    * @param committee The address of the vault's committee 
    * @param isPaused Whether to initialize the vault with deposits disabled
    */
    // Needed to avoid a stack too deep error
    struct VaultInitParams {
        IRewardController rewardController;
        uint256 vestingDuration;
        uint256 vestingPeriods;
        uint256 maxBounty;
        BountySplit bountySplit;
        IERC20 asset;
        address owner;
        address committee;
        bool isPaused;
    }

    uint256 public constant NULL_UINT = type(uint256).max;
    address public constant NULL_ADDRESS = 0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF;
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

    // Time of when withdrawal period starts for every user that has an
    // active withdraw request. (time when last withdraw request pending 
    // period ended, or 0 if last action was deposit or withdraw)
    mapping(address => uint256) public withdrawEnableStartTime;

    // the HATBountySplit of the vault
    HATVaultsRegistry.HATBountySplit internal hatBountySplit;

    // address of the arbitrator - which can dispute claims and override the committee's decisions
    address internal arbitrator;
    // time during which a claim can be challenged by the arbitrator
    uint256 internal challengePeriod;
    // time after which a challenged claim is automatically dismissed
    uint256 internal challengeTimeOutPeriod;

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
    event SetHATBountySplit(HATVaultsRegistry.HATBountySplit _hatBountySplit);
    event SetArbitrator(address indexed _arbitrator);
    event SetChallengePeriod(uint256 _challengePeriod);
    event SetChallengeTimeOutPeriod(uint256 _challengeTimeOutPeriod);

    event WithdrawRequest(
        address indexed _beneficiary,
        uint256 _withdrawEnableTime
    );

    modifier onlyRegistryOwner() {
        if (registry.owner() != msg.sender) revert OnlyRegistryOwner();
        _;
    }

    modifier onlyFeeSetter() {
        if (registry.feeSetter() != msg.sender) revert OnlyFeeSetter();
        _;
    }

    modifier onlyCommittee() {
        if (committee != msg.sender) revert OnlyCommittee();
        _;
    }

    modifier onlyArbitrator() {
        if (getArbitrator() != msg.sender) revert OnlyArbitrator();
        _;
    }

    modifier notEmergencyPaused() {
        if (registry.isEmergencyPaused()) revert SystemInEmergencyPause();
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
        if (activeClaim.claimId != _claimId) revert ClaimIdIsNotActive();
        _;
    }

    /**
    * @notice Initialize a vault instance
    * @param _params The vault initialize parameters
    */
    function initialize(VaultInitParams memory _params) external initializer {
        if (_params.maxBounty > MAX_BOUNTY_LIMIT)
            revert MaxBountyCannotBeMoreThanMaxBountyLimit();
        _validateSplit(_params.bountySplit);
        __ERC4626_init(IERC20MetadataUpgradeable(address(_params.asset)));
        rewardController = _params.rewardController;
        _setVestingParams(_params.vestingDuration, _params.vestingPeriods);
        HATVaultsRegistry _registry = HATVaultsRegistry(msg.sender);
        maxBounty = _params.maxBounty;
        bountySplit = _params.bountySplit;
        committee = _params.committee;
        depositPause = _params.isPaused;
        registry = _registry;
        __ReentrancyGuard_init();
        _transferOwnership(_params.owner);
        tokenLockFactory = _registry.tokenLockFactory();

        // Set vault to use default registry values where applicable
        hatBountySplit = HATVaultsRegistry.HATBountySplit({
            governanceHat: NULL_UINT,
            hackerHatVested: 0
        });
        arbitrator = NULL_ADDRESS;
        challengePeriod = NULL_UINT;
        challengeTimeOutPeriod = NULL_UINT;
    }

    /* ---------------------------------- Claim --------------------------------------- */

    /**
    * @notice Called by the committee to submit a claim for a bounty payout.
    * This function should be called only on a safety period, when withdrawals
    * are disabled.
    * Upon a call to this function by the committee the vault's withdrawals
    * will be disabled until the claim is approved or dismissed. Also from the
    * time of this call the arbitrator will have a period of 
    *`HATVaultsRegistry.challengePeriod` to challenge the claim.
    * @param _beneficiary The submitted claim's beneficiary
    * @param _bountyPercentage The submitted claim's bug requested reward percentage
    */
    function submitClaim(address _beneficiary, uint256 _bountyPercentage, string calldata _descriptionHash)
    external
    onlyCommittee
    noActiveClaim
    notEmergencyPaused
    returns (bytes32 claimId)
    {
        HATVaultsRegistry.GeneralParameters memory generalParameters = registry.getGeneralParameters();
        // require we are in safetyPeriod
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp % (generalParameters.withdrawPeriod + generalParameters.safetyPeriod) <
        generalParameters.withdrawPeriod) revert NotSafetyPeriod();
        if (_bountyPercentage > maxBounty)
            revert BountyPercentageHigherThanMaxBounty();
        claimId = keccak256(abi.encodePacked(address(this), nonce++));
        activeClaim = Claim({
            claimId: claimId,
            beneficiary: _beneficiary,
            bountyPercentage: _bountyPercentage,
            committee: msg.sender,
            // solhint-disable-next-line not-rely-on-time
            createdAt: block.timestamp,
            challengedAt: 0
        });

        emit SubmitClaim(
            claimId,
            msg.sender,
            _beneficiary,
            _bountyPercentage,
            _descriptionHash
        );
    }

    /**
    * @notice Called by the arbitrator to challenge a claim for a bounty
    * payout that had been previously submitted by the committee.
    * Can only be called during the challenge period after submission of the
    * claim.
    * @param _claimId The claim ID
    */
    function challengeClaim(bytes32 _claimId) external onlyArbitrator isActiveClaim(_claimId) {
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp > activeClaim.createdAt + getChallengePeriod())
            revert ChallengePeriodEnded();
        if (activeClaim.challengedAt != 0) {
            revert ClaimAlreadyChallenged();
        } 
        // solhint-disable-next-line not-rely-on-time
        activeClaim.challengedAt = block.timestamp;
        emit ChallengeClaim(_claimId);
    }

    /**
    * @notice Approve a claim for a bounty submitted by a committee, and
    * pay out bounty to hacker and committee. Also transfer to the 
    * HATVaultsRegistry the part of the bounty that will be swapped to HAT 
    * tokens.
    * If the claim had been previously challenged, this is only callable by
    * the arbitrator. Otherwise, callable by anyone after challengePeriod had
    * passed.
    * @param _claimId The claim ID
    * @param _bountyPercentage The percentage of the vault's balance that will
    * be sent as a bounty. This value will be ignored if the caller is not the
    * arbitrator.
    */
    function approveClaim(bytes32 _claimId, uint256 _bountyPercentage) external nonReentrant isActiveClaim(_claimId) {
        Claim memory claim = activeClaim;
        delete activeClaim;

        uint256 _challengePeriod = getChallengePeriod();
        uint256 _challengeTimeOutPeriod = getChallengeTimeOutPeriod();
        
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp >= claim.createdAt + _challengePeriod + _challengeTimeOutPeriod) revert ClaimExpired();
        if (claim.challengedAt != 0) {
            if (
                msg.sender != getArbitrator() ||
                // solhint-disable-next-line not-rely-on-time
                block.timestamp > claim.challengedAt + _challengeTimeOutPeriod
            )
                revert ChallengedClaimCanOnlyBeApprovedByArbitratorUntilChallengeTimeoutPeriod();
            claim.bountyPercentage = _bountyPercentage;
        } else {
            if (
                // solhint-disable-next-line not-rely-on-time
                block.timestamp <= claim.createdAt + _challengePeriod
            ) revert UnchallengedClaimCanOnlyBeApprovedAfterChallengePeriod();
        }

        address tokenLock;

        ClaimBounty memory claimBounty = _calcClaimBounty(claim.bountyPercentage);

        IERC20 asset = IERC20(asset());
        if (claimBounty.hackerVested > 0) {
            //hacker gets part of bounty to a vesting contract
            tokenLock = tokenLockFactory.createTokenLock(
                address(asset),
                0x0000000000000000000000000000000000000000, //this address as owner, so it can do nothing.
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
            asset.safeTransfer(tokenLock, claimBounty.hackerVested);
        }

        asset.safeTransfer(claim.beneficiary, claimBounty.hacker);
        asset.safeTransfer(claim.committee, claimBounty.committee);

        // send to the registry the amount of tokens which should be swapped 
        // to HAT so it could call swapAndSend in a separate tx.
        asset.safeApprove(address(registry), claimBounty.hackerHatVested + claimBounty.governanceHat);
        registry.addTokensToSwap(
            asset,
            claim.beneficiary,
            claimBounty.hackerHatVested,
            claimBounty.governanceHat
        );

        // make sure to reset approval
        asset.safeApprove(address(registry), 0);

        // emit event before deleting the claim object, bcause we want to read beneficiary and bountyPercentage
        emit ApproveClaim(
            _claimId,
            msg.sender,
            claim.beneficiary,
            claim.bountyPercentage,
            tokenLock,
            claimBounty
        );
    }

    /**
    * @notice Dismiss the active claim for bounty payout submitted by the
    * committee. Can only be called if the claim has been challanged.
    * Called either by the arbitrator, or by anyone if the claim is after the
    * challenge timeout period.
    * @param _claimId The claim ID
    */
    function dismissClaim(bytes32 _claimId) external isActiveClaim(_claimId) {
        Claim memory claim = activeClaim;

        uint256 _challengeTimeOutPeriod = getChallengeTimeOutPeriod();
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp < claim.createdAt + getChallengePeriod() + _challengeTimeOutPeriod) {
            if (claim.challengedAt == 0) revert OnlyCallableIfChallenged();
            if (
                // solhint-disable-next-line not-rely-on-time
                block.timestamp < claim.challengedAt + getChallengeTimeOutPeriod() && 
                msg.sender != getArbitrator()
            ) revert OnlyCallableByArbitratorOrAfterChallengeTimeOutPeriod();
        }
        delete activeClaim;

        emit DismissClaim(_claimId);
    }
    /* -------------------------------------------------------------------------------- */

    /* ---------------------------------- Params -------------------------------------- */

    /**
    * @notice Set new committee address. Can be called by existing committee,
    * or by the governance in the case that the committee hadn't checked in
    * yet.
    * @param _committee The address of the new committee 
    */
    function setCommittee(address _committee)
    external {
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
    * @notice Called by governance to set the vesting params for the part of
    * the bounty that the hacker gets vested in the vault's native token
    * @param _duration Duration of the vesting period. Must be smaller than
    * 120 days and bigger than `_periods`
    * @param _periods Number of vesting periods. Cannot be 0.
    */
    function setVestingParams(uint256 _duration, uint256 _periods) external onlyOwner {
        _setVestingParams(_duration, _periods);
    }

    /**
    * @notice Called by the vault's owner to set the vault token bounty split
    * upon an approval.
    * Can only be called if is no active claim and not during safety periods.
    * @param _bountySplit The bounty split
    */
    function setBountySplit(BountySplit memory _bountySplit)
    external
    onlyOwner noActiveClaim noSafetyPeriod {
        _validateSplit(_bountySplit);
        bountySplit = _bountySplit;
        emit SetBountySplit(_bountySplit);
    }

    /**
    * @notice Called by the fee setter to set the fee for withdrawals from the
    * vault.
    * @param _fee The new fee. Must be smaller then `MAX_FEE`
    */
    function setWithdrawalFee(uint256 _fee) external onlyFeeSetter {
        if (_fee > MAX_FEE) revert WithdrawalFeeTooBig();
        withdrawalFee = _fee;
        emit SetWithdrawalFee(_fee);
    }

    /**
    * @notice Called by the vault's committee to claim it's role.
    * Deposits are enabled only after committee check in.
    */
    function committeeCheckIn() external onlyCommittee {
        committeeCheckedIn = true;
        emit CommitteeCheckedIn();
    }

    /**
    * @notice Called by the vault's owner to set a pending request for the
    * maximum percentage of the vault that can be paid out as a bounty.
    * Cannot be called if there is an active claim that has been submitted.
    * Max bounty should be less than or equal to `HUNDRED_PERCENT`.
    * The pending value can later be set after the time delay (of 
    * HATVaultsRegistry.GeneralParameters.setMaxBountyDelay) had passed.
    * Max bounty should be less than or equal to `MAX_BOUNTY_LIMIT`
    * @param _maxBounty The maximum bounty percentage that can be paid out
    */
    function setPendingMaxBounty(uint256 _maxBounty)
    external
    onlyOwner noActiveClaim {
        if (_maxBounty > MAX_BOUNTY_LIMIT)
            revert MaxBountyCannotBeMoreThanMaxBountyLimit();
        pendingMaxBounty.maxBounty = _maxBounty;
        // solhint-disable-next-line not-rely-on-time
        pendingMaxBounty.timestamp = block.timestamp;
        emit SetPendingMaxBounty(_maxBounty, pendingMaxBounty.timestamp);
    }

    /**
    * @notice Called by the vault's owner to set the vault's max bounty to
    * the already pending max bounty.
    * Cannot be called if there are active claims that have been submitted.
    * Can only be called if there is a max bounty pending approval, and the
    * time delay since setting the pending max bounty had passed.
    * Max bounty should be less than or equal to `MAX_BOUNTY_LIMIT`
    */
    function setMaxBounty() external onlyOwner noActiveClaim {
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

    /**
    * @notice Called by governance to disable all deposits to the vault
    * @param _depositPause Are deposits paused
    */
    function setDepositPause(bool _depositPause) external onlyOwner {
        depositPause = _depositPause;
        emit SetDepositPause(_depositPause);
    }

    /**
    * @notice change the description of the vault
    * only calleable by the owner of the vault
    * @param _descriptionHash the hash of the vault's description.
    */
    function setVaultDescription(string memory _descriptionHash) external onlyOwner {
        emit SetVaultDescription(_descriptionHash);
    }

    /**
    * @notice Called by vault's owner to set the vault's reward controller
    * @param _newRewardController The new reward controller
    */
    function setRewardController(IRewardController _newRewardController) external onlyOwner {
        rewardController = _newRewardController;
        emit SetRewardController(_newRewardController);
    }

    /**
    * @notice Called by governance to set the vault HAT token bounty split upon
    * an approval. Either sets it to the value passed, or to the special "null" vaule, 
    * making it always use the registry's default value.
    * @param _hatBountySplit The HAT bounty split
    */
    function setHATBountySplit(HATVaultsRegistry.HATBountySplit memory _hatBountySplit) external onlyRegistryOwner {
        if (_hatBountySplit.governanceHat != NULL_UINT) {
            registry.validateHATSplit(_hatBountySplit);
        }
        hatBountySplit = _hatBountySplit;

        emit SetHATBountySplit(_hatBountySplit);
    }

    /**
    * @notice Called by governance to set the vault arbiitrator
    * @param _arbitrator The vault's arbitrator
    */
    function setArbitrator(address _arbitrator) external onlyRegistryOwner {
        arbitrator = _arbitrator;
        emit SetArbitrator(_arbitrator);
    }

    /**
    * @notice Called by governance to set the vault challenge period
    * @param _challengePeriod The vault's challenge period
    */
    function setChallengePeriod(uint256 _challengePeriod) external onlyRegistryOwner {
        if (_challengePeriod != NULL_UINT) {
            registry.validateChallengePeriod(_challengePeriod);
        }

        challengePeriod = _challengePeriod;
        
        emit SetChallengePeriod(_challengePeriod);
    }

    /**
    * @notice Called by governance to set the vault challenge timeout period
    * @param _challengeTimeOutPeriod The vault's challenge timeout period
    */
    function setChallengeTimeOutPeriod(uint256 _challengeTimeOutPeriod) external onlyRegistryOwner {
        if (_challengeTimeOutPeriod != NULL_UINT) {
            registry.validateChallengeTimeOutPeriod(_challengeTimeOutPeriod);
        }

        challengeTimeOutPeriod = _challengeTimeOutPeriod;
        
        emit SetChallengeTimeOutPeriod(_challengeTimeOutPeriod);
    }

    /* -------------------------------------------------------------------------------- */

    /* ---------------------------------- Vault --------------------------------------- */

    /**
    * @notice Submit a request to withdraw funds from the vault.
    * The request will only be approved if there is no previous active
    * withdraw request.
    * The request will be pending for a period of
    * `HATVaultsRegistry.GeneralParameters.withdrawRequestPendingPeriod`,
    * after which a withdraw will be possible for a duration of
    * `HATVaultsRegistry.GeneralParameters.withdrawRequestEnablePeriod`
    */
    function withdrawRequest() external nonReentrant {
        HATVaultsRegistry.GeneralParameters memory generalParameters = registry.getGeneralParameters();
        // require withdraw to be at least withdrawRequestEnablePeriod+withdrawRequestPendingPeriod
        // since last withdrawRequest (meaning the last withdraw request had expired)
        // unless there's been a deposit or withdraw since, in which case withdrawRequest is allowed immediately
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp <
            withdrawEnableStartTime[msg.sender] +
                generalParameters.withdrawRequestEnablePeriod)
            revert PendingWithdrawRequestExists();
        // set the withdrawEnableStartTime time to be withdrawRequestPendingPeriod from now
        // solhint-disable-next-line not-rely-on-time
        withdrawEnableStartTime[msg.sender] = block.timestamp + generalParameters.withdrawRequestPendingPeriod;
        emit WithdrawRequest(msg.sender, withdrawEnableStartTime[msg.sender]);
    }

    /** 
    * @notice Withdraw previously deposited funds from the vault and claim
    * the HAT reward that the user has earned.
    * Can only be performed if a withdraw request has been previously
    * submitted, and the pending period had passed, and while the withdraw
    * enabled timeout had not passed. Withdrawals are not permitted during
    * safety periods or while there is an active claim for a bounty payout.
    * @param assets Amount of tokens to withdraw
    * @param receiver Address of receiver of the funds
    * @param owner Address of owner of the funds
    * @dev See {IERC4626-withdraw}.
    */
    function withdrawAndClaim(
        uint256 assets,
        address receiver,
        address owner
    ) external returns (uint256 shares) {
        shares = withdraw(assets, receiver, owner);
        rewardController.claimReward(address(this), owner);
    }

    /** 
    * @notice Redeem shares in the vault for the respective amount
    * of underlying assets and claim the HAT reward that the user has earned.
    * Can only be performed if a withdraw request has been previously
    * submitted, and the pending period had passed, and while the withdraw
    * enabled timeout had not passed. Withdrawals are not permitted during
    * safety periods or while there is an active claim for a bounty payout.
    * @param shares Amount of shares to redeem
    * @param receiver Address of receiver of the funds 
    * @param owner Address of owner of the funds 
    * @dev See {IERC4626-redeem}.
    */
    function redeemAndClaim(
        uint256 shares,
        address receiver,
        address owner
    ) external returns (uint256 assets) {
        assets = redeem(shares, receiver, owner);
        rewardController.claimReward(address(this), owner);
    }

    /** 
    * @notice Withdraw previously deposited funds from the vault, without
    * transferring the accumulated HAT reward.
    * Can only be performed if a withdraw request has been previously
    * submitted, and the pending period had passed, and while the withdraw
    * enabled timeout had not passed. Withdrawals are not permitted during
    * safety periods or while there is an active claim for a bounty payout.
    * @param assets Amount of tokens to withdraw
    * @param receiver Address of receiver of the funds 
    * @param owner Address of owner of the funds 
    * @dev See {IERC4626-withdraw}.
    */
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public override virtual returns (uint256) {
        if (assets > maxWithdraw(owner)) revert WithdrawMoreThanMax();

        uint256 shares = previewWithdraw(assets);
        uint256 fee = _convertToAssets(shares - _convertToShares(assets, MathUpgradeable.Rounding.Up), MathUpgradeable.Rounding.Up);
        _withdraw(_msgSender(), receiver, owner, assets, shares, fee);

        return shares;
    }

    /** 
    * @notice Redeem shares in the vault for the respective amount
    * of underlying assets, without transferring the accumulated HAT reward.
    * Can only be performed if a withdraw request has been previously
    * submitted, and the pending period had passed, and while the withdraw
    * enabled timeout had not passed. Withdrawals are not permitted during
    * safety periods or while there is an active claim for a bounty payout.
    * @param shares Amount of shares to redeem
    * @param receiver Address of receiver of the funds 
    * @param owner Address of owner of the funds 
    * @dev See {IERC4626-redeem}.
    */
    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) public override virtual returns (uint256) {
        if (shares > maxRedeem(owner)) revert RedeemMoreThanMax();

        uint256 assets = previewRedeem(shares);
        uint256 fee = _convertToAssets(shares, MathUpgradeable.Rounding.Down) - assets;
        _withdraw(_msgSender(), receiver, owner, assets, shares, fee);

        return assets;
    }

    /** @notice See {IERC4626-maxDeposit}. */
    function maxDeposit(address) public view virtual override returns (uint256) {
        return depositPause ? 0 : type(uint256).max;
    }

    /** @notice See {IERC4626-maxMint}. */
    function maxMint(address) public view virtual override returns (uint256) {
        return depositPause ? 0 : type(uint256).max;
    }

    /** @notice See {IERC4626-maxWithdraw}. */
    function maxWithdraw(address owner) public view virtual override returns (uint256) {
        if (activeClaim.createdAt != 0 || !_isWithdrawEnabledForUser(owner)) return 0;
        return previewRedeem(balanceOf(owner));
    }

    /** @notice See {IERC4626-maxRedeem}. */
    function maxRedeem(address owner) public view virtual override returns (uint256) {
        if (activeClaim.createdAt != 0 || !_isWithdrawEnabledForUser(owner)) return 0;
        return balanceOf(owner);
    }

    /** @notice See {IERC4626-previewWithdraw}. */
    function previewWithdraw(uint256 assets) public view virtual override returns (uint256) {
        uint256 assetsPlusFee = (assets * HUNDRED_PERCENT / (HUNDRED_PERCENT - withdrawalFee));
        return _convertToShares(assetsPlusFee, MathUpgradeable.Rounding.Up);
    }

    /** @notice See {IERC4626-previewRedeem}. */
    function previewRedeem(uint256 shares) public view virtual override returns (uint256) {
        uint256 assets = _convertToAssets(shares, MathUpgradeable.Rounding.Down);
        uint256 fee = assets * withdrawalFee / HUNDRED_PERCENT;
        return assets - fee;
    }

    /* -------------------------------------------------------------------------------- */

    /* --------------------------------- Getters -------------------------------------- */

    /** 
    * @notice Returns the vault HAT bounty split
    */
    function getHATBountySplit() public view returns(HATVaultsRegistry.HATBountySplit memory) {
        if (hatBountySplit.governanceHat != NULL_UINT) {
            return hatBountySplit;
        } else {
            (uint256 governanceHat, uint256 hackerHatVested) = registry.defaultHATBountySplit();
            return HATVaultsRegistry.HATBountySplit({
                governanceHat: governanceHat,
                hackerHatVested: hackerHatVested
            });
        }
    }

    /** 
    * @notice Returns the vault arbitrator
    */
    function getArbitrator() public view returns(address) {
        if (arbitrator != NULL_ADDRESS) {
            return arbitrator;
        } else {
            return registry.defaultArbitrator();
        }
    }

    /** 
    * @notice Returns the vault challenge period
    */
    function getChallengePeriod() public view returns(uint256) {
        if (challengePeriod != NULL_UINT) {
            return challengePeriod;
        } else {
            return registry.defaultChallengePeriod();
        }
    }

    /** 
    * @notice Returns the vault challenge timeout period
    */
    function getChallengeTimeOutPeriod() public view returns(uint256) {
        if (challengeTimeOutPeriod != NULL_UINT) {
            return challengeTimeOutPeriod;
        } else {
            return registry.defaultChallengeTimeOutPeriod();
        }
    }

    /* -------------------------------------------------------------------------------- */

    /* --------------------------------- Helpers -------------------------------------- */

    /**
    * @dev Deposit funds to the vault. Can only be called if the committee had
    * checked in and deposits are not paused.
    * NOTE: Vaults should not use tokens which do not guarantee that the 
    * amount specified is the amount transferred
    * @param caller Caller of the action (msg.sender)
    * @param receiver Reciever of the shares from the deposit
    * @param assets Amount of vault's native token to deposit
    * @param shares Respective amount of shares to be received
    */
    function _deposit(
        address caller,
        address receiver,
        uint256 assets,
        uint256 shares
    ) internal override virtual nonReentrant {
        if (!committeeCheckedIn)
            revert CommitteeNotCheckedInYet();
        if (shares == 0) revert AmountToDepositIsZero();
        if (withdrawEnableStartTime[receiver] != 0 && receiver == caller) {
            // clear withdraw request
            withdrawEnableStartTime[receiver] = 0;
        }

        super._deposit(caller, receiver, assets, shares);
    }

    function _withdraw(
        address caller,
        address receiver,
        address owner,
        uint256 assets,
        uint256 shares,
        uint256 fee
    ) internal nonReentrant {
        if (assets == 0) revert WithdrawMustBeGreaterThanZero();
        if (caller != owner) {
            _spendAllowance(owner, caller, shares);
        }

        _burn(owner, shares);

        IERC20 asset = IERC20(asset());
        if (fee > 0) {
            asset.safeTransfer(registry.owner(), fee);
        }
        asset.safeTransfer(receiver, assets);

        emit Withdraw(caller, receiver, owner, assets, shares);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        if (to != address(0)) {
            if (registry.isEmergencyPaused()) revert SystemInEmergencyPause();
            // Cannot transfer or mint tokens to a user for which an active withdraw request exists
            // because then we would need to reset their withdraw request
            if (withdrawEnableStartTime[to] != 0) {
                HATVaultsRegistry.GeneralParameters memory generalParameters = registry.getGeneralParameters();
                // solhint-disable-next-line not-rely-on-time
                if (block.timestamp < withdrawEnableStartTime[to] + generalParameters.withdrawRequestEnablePeriod)
                    revert CannotTransferToAnotherUserWithActiveWithdrawRequest();
            }
            rewardController.updateVaultBalance(to, amount, true);
        }

        if (from != address(0)) {
            if (activeClaim.createdAt != 0) revert ActiveClaimExists();
            if (!_isWithdrawEnabledForUser(from)) revert InvalidWithdrawRequest();
            // if all is ok and withdrawal can be made - 
            // reset withdrawRequests[_pid][msg.sender] so that another withdrawRequest
            // will have to be made before next withdrawal
            withdrawEnableStartTime[from] = 0;

            rewardController.updateVaultBalance(from, amount, false);
        }
    }

    function _setVestingParams(uint256 _duration, uint256 _periods) internal {
        if (_duration > 120 days) revert VestingDurationTooLong();
        if (_periods == 0) revert VestingPeriodsCannotBeZero();
        if (_duration < _periods) revert VestingDurationSmallerThanPeriods();
        vestingDuration = _duration;
        vestingPeriods = _periods;
        emit SetVestingParams(_duration, _periods);
    }

    /**
    * @dev Checks that the given user can perform a withdraw at this time
    * @param _user Address of the user to check
    */
    function _isWithdrawEnabledForUser(address _user)
        internal view
        returns(bool)
    {
        HATVaultsRegistry.GeneralParameters memory generalParameters = registry.getGeneralParameters();
        // disable withdraw for safetyPeriod (e.g 1 hour) after each withdrawPeriod (e.g 11 hours)
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp %
        (generalParameters.withdrawPeriod + generalParameters.safetyPeriod) >=
            generalParameters.withdrawPeriod) return false;
        // check that withdrawRequestPendingPeriod had passed
        // solhint-disable-next-line not-rely-on-time
        return (block.timestamp >= withdrawEnableStartTime[_user] &&
        // check that withdrawRequestEnablePeriod had not passed and that the
        // last action was withdrawRequest (and not deposit or withdraw, which
        // reset withdrawRequests[_user] to 0)
        // solhint-disable-next-line not-rely-on-time
            block.timestamp <=
                withdrawEnableStartTime[_user] +
                generalParameters.withdrawRequestEnablePeriod);
    }

    /**
    * @dev calculate the specific bounty payout distribution, according to the
    * predefined bounty split and the given bounty percentage
    * @param _bountyPercentage The percentage of the vault's funds to be paid
    * out as bounty
    * @return claimBounty The bounty distribution for this specific claim
    */
    function _calcClaimBounty(uint256 _bountyPercentage) internal view returns(ClaimBounty memory claimBounty) {
        uint256 totalSupply = totalAssets();
        if (totalSupply == 0) {
          return claimBounty;
        }
        if (_bountyPercentage > maxBounty)
            revert BountyPercentageHigherThanMaxBounty();

        HATVaultsRegistry.HATBountySplit memory _hatBountySplit = getHATBountySplit();
        uint256 totalBountyAmount = totalSupply * _bountyPercentage;

        uint256 governanceHatAmount = totalBountyAmount * _hatBountySplit.governanceHat / HUNDRED_PERCENT_SQRD;
        uint256 hackerHatVestedAmount = totalBountyAmount * _hatBountySplit.hackerHatVested / HUNDRED_PERCENT_SQRD;

        totalBountyAmount -= (governanceHatAmount + hackerHatVestedAmount) * HUNDRED_PERCENT;

        claimBounty.governanceHat = governanceHatAmount;
        claimBounty.hackerHatVested = hackerHatVestedAmount;

        uint256 hackerVestedAmount = totalBountyAmount * bountySplit.hackerVested / HUNDRED_PERCENT_SQRD;
        uint256 hackerAmount = totalBountyAmount * bountySplit.hacker / HUNDRED_PERCENT_SQRD;

        totalBountyAmount -= (hackerVestedAmount + hackerAmount) * HUNDRED_PERCENT;

        claimBounty.hackerVested = hackerVestedAmount;
        claimBounty.hacker = hackerAmount;

        // give all the tokens left to the committee to avoid rounding errors
        claimBounty.committee = totalBountyAmount / HUNDRED_PERCENT;
    }

    /** 
    * @dev Check that a given bounty split is legal, meaning that:
    *   Each entry is a number between 0 and `HUNDRED_PERCENT`.
    *   Total splits should be equal to `HUNDRED_PERCENT`.
    * function will revert in case the bounty split is not legal.
    * @param _bountySplit The bounty split to check
    */
    function _validateSplit(BountySplit memory _bountySplit) internal pure {
        if (_bountySplit.hackerVested +
            _bountySplit.hacker +
            _bountySplit.committee != HUNDRED_PERCENT)
            revert TotalSplitPercentageShouldBeHundredPercent();
    }

    /* -------------------------------------------------------------------------------- */
}
