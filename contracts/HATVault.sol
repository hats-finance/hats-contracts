// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.14;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
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
// Amount to swap is zero
error AmountToSwapIsZero();
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
// Token approve failed
error TokenApproveFailed();
// Wrong amount received
error AmountSwappedLessThanMinimum();
// Max bounty cannot be more than `HUNDRED_PERCENT`
error MaxBountyCannotBeMoreThanHundredPercent();
// LP token is zero
error AssetIsZero();
// Only fee setter
error OnlyFeeSetter();
// Fee must be less than or equal to 2%
error WithdrawalFeeTooBig();
// Token approve reset failed
error TokenApproveResetFailed();
// Set shares arrays must have same length
error SetSharesArraysMustHaveSameLength();
// Committee not checked in yet
error CommitteeNotCheckedInYet();
// Not enough user balance
error NotEnoughUserBalance();
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
error CannotDepositToAnotherUserWithWithdrawRequest();
error WithdrawMustBeGreaterThanZero();
error WithdrawMoreThanMax();
error RedeemMoreThanMax();

contract HATVault is ERC4626Upgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;
    using SafeERC20 for ERC20Burnable;

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
    uint256 public constant MAX_FEE = 200; // Max fee is 2%

    HATVaultsRegistry public registry;
    ITokenLockFactory public tokenLockFactory;
    ERC20Burnable public swapToken;

    uint256 public activeClaim;
    // claimId -> Claim
    mapping(uint256 => Claim) public claims;

    IRewardController public rewardController;

    BountySplit public bountySplit;
    uint256 public maxBounty;
    uint256 public vestingDuration;
    uint256 public vestingPeriods;

    bool public committeeCheckedIn;
    uint256 public balance;
    uint256 public withdrawalFee;

    uint256 internal nonce;

    address public committee;

    PendingMaxBounty public pendingMaxBounty;

    bool public depositPause;

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
    event SetCommittee(address indexed _committee);
    event SetVestingParams(
        uint256 indexed _duration,
        uint256 indexed _periods
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
        IERC20 _asset,
        address _committee,
        bool _isPaused
    ) external initializer {
        if (_vestingDuration > 120 days)
            revert VestingDurationTooLong();
        if (_vestingPeriods == 0) revert VestingPeriodsCannotBeZero();
        if (_vestingDuration < _vestingPeriods)
            revert VestingDurationSmallerThanPeriods();
        if (_committee == address(0)) revert CommitteeIsZero();
        if (address(_asset) == address(0)) revert AssetIsZero();
        if (_maxBounty > HUNDRED_PERCENT)
            revert MaxBountyCannotBeMoreThanHundredPercent();
        validateSplit(_bountySplit);
        __ERC4626_init(IERC20MetadataUpgradeable(address(_asset)));
        rewardController = _rewardController;
        vestingDuration = _vestingDuration;
        vestingPeriods = _vestingPeriods;
        maxBounty = _maxBounty;
        bountySplit = _bountySplit;
        committee = _committee;
        depositPause = _isPaused;
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
    * Upon a call to this function by the committee the vault's withdrawals will be disabled
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

        IERC20 asset = IERC20(asset());
        if (claimBounty.hackerVested > 0) {
            //hacker gets part of bounty to a vesting contract
            tokenLock = tokenLockFactory.createTokenLock(
                address(asset),
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
            asset.safeTransfer(tokenLock, claimBounty.hackerVested);
        }

        asset.safeTransfer(claim.beneficiary, claimBounty.hacker);
        asset.safeTransfer(claim.committee, claimBounty.committee);
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
        if (totalSupply == 0) revert VaultBalanceIsZero();
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
    // @note: Vaults should not use tokens which does not guarantee
    // that the amount specified is the amount transferred
    function _deposit(
        address caller,
        address receiver,
        uint256 assets,
        uint256 shares
    ) internal override nonReentrant {
        if (!committeeCheckedIn)
            revert CommitteeNotCheckedInYet();
        if (assets == 0) revert AmountToDepositIsZero();
        // Users can only deposit for themselves if withdraw request exists
        if (withdrawEnableStartTime[receiver] != 0 && receiver != caller) {
            revert CannotDepositToAnotherUserWithWithdrawRequest();
        }

        // clear withdraw request
        withdrawEnableStartTime[receiver] = 0;

        rewardController.updateVaultBalance(receiver, shares, true, true);

        balance += assets;
        super._deposit(caller, receiver, assets, shares);
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

    function setWithdrawalFee(uint256 _newFee) external onlyFeeSetter {
        if (_newFee > MAX_FEE) revert WithdrawalFeeTooBig();
        withdrawalFee = _newFee;
        emit SetWithdrawalFee(_newFee);
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
    * @notice Set pending request to set vault's max bounty.
    * The function can be called only by the vault's committee.
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
    * @notice Set the vault's max bounty to the already pending max bounty.
    * The function can be called only by the vault's committee.
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

    /* ----------------------------------- Info --------------------------------------- */

    // TODO: Update this function name (maybe split it up)
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

    /* -------------------------------------------------------------------------------- */

    /* ----------------------------------- Swap --------------------------------------- */

    /**
    * @notice Swap the vault's token to swapToken.
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
        IERC20 asset = IERC20(asset());
        ERC20Burnable _swapToken = swapToken;
        if (address(asset) == address(_swapToken)) {
            return _amount;
        }
        if (!registry.whitelistedRouters(_routingContract))
            revert RoutingContractNotWhitelisted();
        if (!asset.approve(_routingContract, _amount))
            revert TokenApproveFailed();
        uint256 balanceBefore = _swapToken.balanceOf(address(this));

        // solhint-disable-next-line avoid-low-level-calls
        (bool success,) = _routingContract.call(_routingPayload);
        if (!success) revert SwapFailed();
        swapTokenReceived = _swapToken.balanceOf(address(this)) - balanceBefore;
        if (swapTokenReceived < _amountOutMinimum)
            revert AmountSwappedLessThanMinimum();
            
        if (!asset.approve(address(_routingContract), 0))
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

    function _withdraw(
        address caller,
        address receiver,
        address owner,
        uint256 assets,
        uint256 shares,
        uint256 fee,
        bool claimReward
    ) internal nonReentrant {
        // TODO: If a user gives allowance to another user, that other user can spam to some extent the allowing user's withdraw request
        // Should consider disallowing withdraw from another user.
        checkWithdrawAndResetWithdrawEnableStartTime(owner);
        if (shares == 0) revert WithdrawMustBeGreaterThanZero();
        if (caller != owner) {
            _spendAllowance(owner, caller, shares);
        }

        rewardController.updateVaultBalance(owner, shares, false, claimReward);

        _burn(owner, shares);
        balance -= assets + fee;
        safeWithdrawVaultToken(assets, fee, receiver);

        emit Withdraw(caller, receiver, owner, assets, shares);
    }

    /** @dev See {IERC4626-withdraw}. */
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public override returns (uint256) {
        if (assets > maxWithdraw(owner)) revert WithdrawMoreThanMax();

        uint256 shares = previewWithdraw(assets);
        uint256 fee = _convertToAssets(shares - _convertToShares(assets, MathUpgradeable.Rounding.Up), MathUpgradeable.Rounding.Up);
        _withdraw(_msgSender(), receiver, owner, assets, shares, fee, true);

        return shares;
    }

    /** @dev See {IERC4626-redeem}. */
    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) public override returns (uint256) {
        if (shares > maxRedeem(owner)) revert RedeemMoreThanMax();

        uint256 assets = previewRedeem(shares);
        uint256 fee = _convertToAssets(shares, MathUpgradeable.Rounding.Down) - assets;
        _withdraw(_msgSender(), receiver, owner, assets, shares, fee, true);

        return assets;
    }

    /**
    * @dev Withdraw/redeem common workflow.
    */
    function emergencyWithdraw() external {
        // TODO: If a user gives allowance to another user, that other user can spam to some extent the allowing user's withdraw request
        // Should consider disallowing withdraw from another user.
        address msgSender = _msgSender();
        uint256 shares = balanceOf(msgSender);
        uint256 assets = previewRedeem(shares);
        uint256 fee = _convertToAssets(shares, MathUpgradeable.Rounding.Down) - assets;
        _withdraw(msgSender, msgSender, msgSender, assets, shares, fee, false);
        emit EmergencyWithdraw(msgSender, assets, shares);
    }

    // @notice Checks that the sender can perform a withdraw at this time
    // and also sets the withdrawRequest to 0
    function checkWithdrawAndResetWithdrawEnableStartTime(address user)
        internal
        noActiveClaim
    {
        if (!isWithdrawEnabledForUser(user))
            revert InvalidWithdrawRequest();
        // if all is ok and withdrawal can be made - reset withdrawRequests[_pid][msg.sender] so that another withdrawRequest
        // will have to be made before next withdrawal
        withdrawEnableStartTime[user] = 0;
    }

    // @notice Checks that the sender can perform a withdraw at this time
    function isWithdrawEnabledForUser(address user)
        internal view
        returns(bool)
    {
        HATVaultsRegistry.GeneralParameters memory generalParameters = registry.getGeneralParameters();
        //disable withdraw for safetyPeriod (e.g 1 hour) after each withdrawPeriod(e.g 11 hours)
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp %
        (generalParameters.withdrawPeriod + generalParameters.safetyPeriod) >=
            generalParameters.withdrawPeriod) return false;
        // check that withdrawRequestPendingPeriod had passed
        // solhint-disable-next-line not-rely-on-time
        return !(block.timestamp < withdrawEnableStartTime[user] ||
        // check that withdrawRequestEnablePeriod had not passed and that the
        // last action was withdrawRequest (and not deposit or withdraw, which
        // reset withdrawRequests[user] to 0)
        // solhint-disable-next-line not-rely-on-time
            block.timestamp >
                withdrawEnableStartTime[user] +
                generalParameters.withdrawRequestEnablePeriod);
    }

    function safeWithdrawVaultToken(uint256 _totalAmount, uint256 _fee, address _receiver)
        internal
    {
        IERC20 asset = IERC20(asset());
        if (_fee > 0) {
            asset.safeTransfer(owner(), _fee);
        }
        asset.safeTransfer(_receiver, _totalAmount);
    }

    /* -------------------------------------------------------------------------------- */

     /** @dev See {IERC4626-totalAssets}. */
    function totalAssets() public view virtual override returns (uint256) {
        return balance;
    }

    /** @dev See {IERC4626-maxDeposit}. */
    function maxDeposit(address) public view virtual override returns (uint256) {
        return depositPause ? 0 : type(uint256).max;
    }

    /** @dev See {IERC4626-maxMint}. */
    function maxMint(address) public view virtual override returns (uint256) {
        return depositPause ? 0 : type(uint256).max;
    }

    /** @dev See {IERC4626-maxWithdraw}. */
    function maxWithdraw(address owner) public view virtual override returns (uint256) {
        if (activeClaim != 0 || !isWithdrawEnabledForUser(owner)) return 0;
        return previewRedeem(balanceOf(owner));
    }

    /** @dev See {IERC4626-maxRedeem}. */
    function maxRedeem(address owner) public view virtual override returns (uint256) {
        if (activeClaim != 0 || !isWithdrawEnabledForUser(owner)) return 0;
        return balanceOf(owner);
    }

    /** @dev See {IERC4626-previewWithdraw}. */
    function previewWithdraw(uint256 assets) public view virtual override returns (uint256) {
        uint256 assetsPlusFee = (assets / (HUNDRED_PERCENT - withdrawalFee)) * HUNDRED_PERCENT;
       return _convertToShares(assetsPlusFee, MathUpgradeable.Rounding.Up);
    }
    /** @dev See {IERC4626-previewRedeem}. */
    function previewRedeem(uint256 shares) public view virtual override returns (uint256) {
        uint256 assets = _convertToAssets(shares, MathUpgradeable.Rounding.Down);
        uint256 fee = assets * withdrawalFee / HUNDRED_PERCENT;
        return assets - fee;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        if (from == address(0) || to == address(0)) {
            return;
        }
        // Users can only deposit for themselves if withdraw request exists
        if (withdrawEnableStartTime[to] != 0) {
            revert CannotDepositToAnotherUserWithWithdrawRequest();
        }

        checkWithdrawAndResetWithdrawEnableStartTime(from);

        rewardController.updateVaultBalance(to, amount, true, true);
        rewardController.updateVaultBalance(from, amount, false, true);
    }
}
