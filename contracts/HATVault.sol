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
import "./interfaces/IHATVault.sol";
import "./interfaces/IRewardController.sol";
import "./HATVaultsRegistry.sol";

/** @title A Hats.finance vault which holds the funds for a specific project's
* bug bounties
* @author Hats.finance
* @notice The HATVault can be deposited into in a permissionless maner using
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
*/
contract HATVault is IHATVault, ERC4626Upgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    struct Claim {
        bytes32 claimId;
        address beneficiary;
        uint256 bountyPercentage;
        // the address of the committee at the time of the submission, so that this committee will
        // be paid their share of the bounty in case the committee changes before claim approval
        address committee;
        uint256 createdAt;
        uint256 challengedAt;
        uint256 bountyGovernanceHAT;
        uint256 bountyHackerHATVested;
        address arbitrator;
        uint256 challengePeriod;
        uint256 challengeTimeOutPeriod;
        bool arbitratorCanChangeBounty;
    }

    struct PendingMaxBounty {
        uint256 maxBounty;
        uint256 timestamp;
    }

    uint256 public constant NULL_UINT = type(uint256).max;
    address public constant NULL_ADDRESS = 0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF;
    uint256 public constant HUNDRED_PERCENT = 10000;
    uint256 public constant MAX_BOUNTY_LIMIT = 9000; // Max bounty can be up to 90%
    uint256 public constant MAX_COMMITTEE_BOUNTY = 1000; // Max committee bounty can be up to 10%
    uint256 public constant HUNDRED_PERCENT_SQRD = 100000000;
    uint256 public constant MAX_WITHDRAWAL_FEE = 200; // Max fee is 2%

    HATVaultsRegistry public registry;
    ITokenLockFactory public tokenLockFactory;

    Claim public activeClaim;

    IRewardController public rewardController;

    IHATVault.BountySplit public bountySplit;
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

    mapping(address => bool) public rewardControllerRemoved;

    // the percentage of the total bounty to be swapped to HATs and sent to governance
    uint256 internal bountyGovernanceHAT;
    // the percentage of the total bounty to be swapped to HATs and sent to the hacker via vesting contract
    uint256 internal bountyHackerHATVested;

    // address of the arbitrator - which can dispute claims and override the committee's decisions
    address internal arbitrator;
    // time during which a claim can be challenged by the arbitrator
    uint256 internal challengePeriod;
    // time after which a challenged claim is automatically dismissed
    uint256 internal challengeTimeOutPeriod;
    // whether the arbitrator can change bounty of claims
    ArbitratorCanChangeBounty internal arbitratorCanChangeBounty;

    bool private _isEmergencyWithdraw;

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

    modifier notEmergencyPaused() {
        if (registry.isEmergencyPaused()) revert SystemInEmergencyPause();
        _;
    }

    modifier noSafetyPeriod() {
        IHATVaultsRegistry.GeneralParameters memory generalParameters = registry.getGeneralParameters();
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

    /** @notice See {IHATVault-initialize}. */
    function initialize(IHATVault.VaultInitParams memory _params) external initializer {
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
        arbitrator = NULL_ADDRESS;
        bountyGovernanceHAT = NULL_UINT;
        bountyHackerHATVested = NULL_UINT;
        arbitratorCanChangeBounty = ArbitratorCanChangeBounty.DEFAULT;
        challengePeriod = NULL_UINT;
        challengeTimeOutPeriod = NULL_UINT;
    }

    /* ---------------------------------- Claim --------------------------------------- */

    /** @notice See {IHATVault-submitClaim}. */
    function submitClaim(address _beneficiary, uint256 _bountyPercentage, string calldata _descriptionHash)
        external onlyCommittee noActiveClaim notEmergencyPaused returns (bytes32 claimId) {
        IHATVaultsRegistry.GeneralParameters memory generalParameters = registry.getGeneralParameters();
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
            challengedAt: 0,
            bountyGovernanceHAT: getBountyGovernanceHAT(),
            bountyHackerHATVested: getBountyHackerHATVested(),
            arbitrator: getArbitrator(),
            challengePeriod: getChallengePeriod(),
            challengeTimeOutPeriod: getChallengeTimeOutPeriod(),
            arbitratorCanChangeBounty: getArbitratorCanChangeBounty()
        });

        emit SubmitClaim(
            claimId,
            msg.sender,
            _beneficiary,
            _bountyPercentage,
            _descriptionHash
        );
    }

    function challengeClaim(bytes32 _claimId) external isActiveClaim(_claimId) {
        if (
            registry.owner() != msg.sender &&
            activeClaim.arbitrator != msg.sender
        ) revert OnlyArbitratorOrRegistryOwner();
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp > activeClaim.createdAt + activeClaim.challengePeriod)
            revert ChallengePeriodEnded();
        if (activeClaim.challengedAt != 0) {
            revert ClaimAlreadyChallenged();
        } 
        // solhint-disable-next-line not-rely-on-time
        activeClaim.challengedAt = block.timestamp;
        emit ChallengeClaim(_claimId);
    }

    /** @notice See {IHATVault-approveClaim}. */
    function approveClaim(bytes32 _claimId, uint256 _bountyPercentage) external nonReentrant isActiveClaim(_claimId) {
        Claim memory claim = activeClaim;
        delete activeClaim;
        
        
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp >= claim.createdAt + claim.challengePeriod + claim.challengeTimeOutPeriod) {
            // cannot approve an expired claim
            revert ClaimExpired();
        } 
        if (claim.challengedAt != 0) {
            // the claim was challenged, and only the arbitrator can approve it, within the timeout period
            if (
                msg.sender != claim.arbitrator ||
                // solhint-disable-next-line not-rely-on-time
                block.timestamp > claim.challengedAt + claim.challengeTimeOutPeriod
            ) {
                revert ChallengedClaimCanOnlyBeApprovedByArbitratorUntilChallengeTimeoutPeriod();
            }
            // the arbitrator can update the bounty if needed
            if(claim.arbitratorCanChangeBounty) {
                claim.bountyPercentage = _bountyPercentage;
            }
        } else {
            // the claim can be approved by anyone if the challengePeriod passed without a challenge
            if (
                // solhint-disable-next-line not-rely-on-time
                block.timestamp <= claim.createdAt + claim.challengePeriod
            ) revert UnchallengedClaimCanOnlyBeApprovedAfterChallengePeriod();
        }

        address tokenLock;

        IHATVault.ClaimBounty memory claimBounty = _calcClaimBounty(
            claim.bountyPercentage,
            claim.bountyGovernanceHAT,
            claim.bountyHackerHATVested
        );

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

        emit ApproveClaim(
            _claimId,
            msg.sender,
            claim.beneficiary,
            claim.bountyPercentage,
            tokenLock,
            claimBounty
        );
    }

    /** @notice See {IHATVault-dismissClaim}. */
    function dismissClaim(bytes32 _claimId) external isActiveClaim(_claimId) {
        Claim memory claim = activeClaim;

        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp < claim.createdAt + claim.challengePeriod + claim.challengeTimeOutPeriod) {
            if (claim.challengedAt == 0) revert OnlyCallableIfChallenged();
            if (
                // solhint-disable-next-line not-rely-on-time
                block.timestamp < claim.challengedAt + claim.challengeTimeOutPeriod && 
                msg.sender != claim.arbitrator
            ) revert OnlyCallableByArbitratorOrAfterChallengeTimeOutPeriod();
        } // else the claim is expired and should be dismissed
        delete activeClaim;

        emit DismissClaim(_claimId);
    }
    /* -------------------------------------------------------------------------------- */

    /* ---------------------------------- Params -------------------------------------- */

    /** @notice See {IHATVault-setCommittee}. */
    function setCommittee(address _committee) external {
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

    /** @notice See {IHATVault-setVestingParams}. */
    function setVestingParams(uint256 _duration, uint256 _periods) external onlyOwner {
        _setVestingParams(_duration, _periods);
    }

    /** @notice See {IHATVault-setBountySplit}. */
    function setBountySplit(IHATVault.BountySplit memory _bountySplit) external onlyOwner noActiveClaim noSafetyPeriod {
        _validateSplit(_bountySplit);
        bountySplit = _bountySplit;
        emit SetBountySplit(_bountySplit);
    }

    /** @notice See {IHATVault-setWithdrawalFee}. */
    function setWithdrawalFee(uint256 _fee) external onlyFeeSetter {
        if (_fee > MAX_WITHDRAWAL_FEE) revert WithdrawalFeeTooBig();
        withdrawalFee = _fee;
        emit SetWithdrawalFee(_fee);
    }

    /** @notice See {IHATVault-committeeCheckIn}. */
    function committeeCheckIn() external onlyCommittee {
        committeeCheckedIn = true;
        emit CommitteeCheckedIn();
    }

    /** @notice See {IHATVault-setPendingMaxBounty}. */
    function setPendingMaxBounty(uint256 _maxBounty) external onlyOwner noActiveClaim {
        if (_maxBounty > MAX_BOUNTY_LIMIT)
            revert MaxBountyCannotBeMoreThanMaxBountyLimit();
        pendingMaxBounty.maxBounty = _maxBounty;
        // solhint-disable-next-line not-rely-on-time
        pendingMaxBounty.timestamp = block.timestamp;
        emit SetPendingMaxBounty(_maxBounty, pendingMaxBounty.timestamp);
    }

    /** @notice See {IHATVault-setMaxBounty}. */
    function setMaxBounty() external onlyOwner noActiveClaim {
        if (pendingMaxBounty.timestamp == 0) revert NoPendingMaxBounty();

        IHATVaultsRegistry.GeneralParameters memory generalParameters = registry.getGeneralParameters();

        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp - pendingMaxBounty.timestamp <
            generalParameters.setMaxBountyDelay)
            revert DelayPeriodForSettingMaxBountyHadNotPassed();
        maxBounty = pendingMaxBounty.maxBounty;
        delete pendingMaxBounty;
        emit SetMaxBounty(maxBounty);
    }

    /** @notice See {IHATVault-setDepositPause}. */
    function setDepositPause(bool _depositPause) external onlyOwner {
        depositPause = _depositPause;
        emit SetDepositPause(_depositPause);
    }

    /** @notice See {IHATVault-setVaultDescription}. */
    function setVaultDescription(string memory _descriptionHash) external onlyOwner {
        emit SetVaultDescription(_descriptionHash);
    }

    /** @notice See {IHATVault-setRewardController}. */
    function setRewardController(IRewardController _newRewardController) external onlyRegistryOwner noActiveClaim {
        rewardControllerRemoved[address(rewardController)] = true;
        if (rewardControllerRemoved[address(_newRewardController)]) revert CannotSetToPerviousRewardController();
        rewardController = _newRewardController;
        emit SetRewardController(_newRewardController);
    }
    
    /** @notice See {IHATVault-setHATBountySplit}. */
    function setHATBountySplit(uint256 _bountyGovernanceHAT, uint256 _bountyHackerHATVested) external onlyRegistryOwner {
        bountyGovernanceHAT = _bountyGovernanceHAT;
        bountyHackerHATVested = _bountyHackerHATVested;

        registry.validateHATSplit(getBountyGovernanceHAT(), getBountyHackerHATVested());

        emit SetHATBountySplit(_bountyGovernanceHAT, _bountyHackerHATVested);
    }

    /** @notice See {IHATVault-setArbitrator}. */
    function setArbitrator(address _arbitrator) external onlyRegistryOwner {
        arbitrator = _arbitrator;
        emit SetArbitrator(_arbitrator);
    }

    /** @notice See {IHATVault-setChallengePeriod}. */
    function setChallengePeriod(uint256 _challengePeriod) external onlyRegistryOwner {
        if (_challengePeriod != NULL_UINT) {
            registry.validateChallengePeriod(_challengePeriod);
        }

        challengePeriod = _challengePeriod;
        
        emit SetChallengePeriod(_challengePeriod);
    }

    /** @notice See {IHATVault-setChallengeTimeOutPeriod}. */
    function setChallengeTimeOutPeriod(uint256 _challengeTimeOutPeriod) external onlyRegistryOwner {
        if (_challengeTimeOutPeriod != NULL_UINT) {
            registry.validateChallengeTimeOutPeriod(_challengeTimeOutPeriod);
        }

        challengeTimeOutPeriod = _challengeTimeOutPeriod;
        
        emit SetChallengeTimeOutPeriod(_challengeTimeOutPeriod);
    }

    /** @notice See {IHATVault-setArbitratorCanChangeBounty}. */
    function setArbitratorCanChangeBounty(ArbitratorCanChangeBounty _arbitratorCanChangeBounty) external onlyRegistryOwner {
        arbitratorCanChangeBounty = _arbitratorCanChangeBounty;
        emit SetArbitratorCanChangeBounty(_arbitratorCanChangeBounty);
    }

    /* -------------------------------------------------------------------------------- */

    /* ---------------------------------- Vault --------------------------------------- */

    /** @notice See {IHATVault-withdrawRequest}. */
    function withdrawRequest() external nonReentrant {
        IHATVaultsRegistry.GeneralParameters memory generalParameters = registry.getGeneralParameters();
        // require withdraw to be at least withdrawRequestEnablePeriod+withdrawRequestPendingPeriod
        // since last withdrawRequest (meaning the last withdraw request had expired)
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

    /** @notice See {IHATVault-withdrawAndClaim}. */
    function withdrawAndClaim(uint256 assets, address receiver, address owner) external returns (uint256 shares) {
        shares = withdraw(assets, receiver, owner);
        rewardController.claimReward(address(this), owner);
    }

    /** @notice See {IHATVault-redeemAndClaim}. */
    function redeemAndClaim(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
        assets = redeem(shares, receiver, owner);
        rewardController.claimReward(address(this), owner);
    }

    /** @notice See {IHATVault-emergencyWithdraw}. */
    function emergencyWithdraw(address receiver) external returns (uint256 assets) {
        _isEmergencyWithdraw = true;
        assets = redeem(balanceOf(_msgSender()), receiver, _msgSender());
        _isEmergencyWithdraw = false;
    }

    /** @notice See {IHATVault-withdraw}. */
    function withdraw(uint256 assets, address receiver, address owner) 
        public override(IHATVault, ERC4626Upgradeable) virtual returns (uint256) {

        uint256 shares = previewWithdraw(assets);
        uint256 fee = _convertToAssets(shares - _convertToShares(assets, MathUpgradeable.Rounding.Up), MathUpgradeable.Rounding.Up);
        _withdraw(_msgSender(), receiver, owner, assets, shares, fee);

        return shares;
    }

    /** @notice See {IHATVault-redeem}. */
    function redeem(uint256 shares, address receiver, address owner) 
        public  override(IHATVault, ERC4626Upgradeable) virtual returns (uint256) {

        uint256 assets = previewRedeem(shares);
        uint256 fee = _convertToAssets(shares, MathUpgradeable.Rounding.Down) - assets;
        _withdraw(_msgSender(), receiver, owner, assets, shares, fee);

        return assets;
    }

    /** @notice See {IHATVault-deposit}. */
    function deposit(uint256 assets, address receiver) public override(IHATVault, ERC4626Upgradeable) virtual returns (uint256) {
        return super.deposit(assets, receiver);
    }

    /** @notice See {IERC4626Upgradeable-maxDeposit}. */
    function maxDeposit(address) public view virtual override(IERC4626Upgradeable, ERC4626Upgradeable) returns (uint256) {
        return depositPause ? 0 : type(uint256).max;
    }

    /** @notice See {IERC4626Upgradeable-maxMint}. */
    function maxMint(address) public view virtual override(IERC4626Upgradeable, ERC4626Upgradeable) returns (uint256) {
        return depositPause ? 0 : type(uint256).max;
    }

    /** @notice See {IERC4626Upgradeable-maxWithdraw}. */
    function maxWithdraw(address owner) public view virtual override(IERC4626Upgradeable, ERC4626Upgradeable) returns (uint256) {
        if (activeClaim.createdAt != 0 || !_isWithdrawEnabledForUser(owner)) return 0;
        return previewRedeem(balanceOf(owner));
    }

    /** @notice See {IERC4626Upgradeable-maxRedeem}. */
    function maxRedeem(address owner) public view virtual override(IERC4626Upgradeable, ERC4626Upgradeable) returns (uint256) {
        if (activeClaim.createdAt != 0 || !_isWithdrawEnabledForUser(owner)) return 0;
        return balanceOf(owner);
    }

    /** @notice See {IERC4626Upgradeable-previewWithdraw}. */
    function previewWithdraw(uint256 assets) public view virtual override(IERC4626Upgradeable, ERC4626Upgradeable) returns (uint256) {
        uint256 assetsPlusFee = (assets * HUNDRED_PERCENT / (HUNDRED_PERCENT - withdrawalFee));
        return _convertToShares(assetsPlusFee, MathUpgradeable.Rounding.Up);
    }

    /** @notice See {IERC4626Upgradeable-previewRedeem}. */
    function previewRedeem(uint256 shares) public view virtual override(IERC4626Upgradeable, ERC4626Upgradeable) returns (uint256) {
        uint256 assets = _convertToAssets(shares, MathUpgradeable.Rounding.Down);
        uint256 fee = assets * withdrawalFee / HUNDRED_PERCENT;
        return assets - fee;
    }

    /* -------------------------------------------------------------------------------- */

    /* --------------------------------- Getters -------------------------------------- */

    /** @notice See {IHATVault-getBountyGovernanceHAT}. */
    function getBountyGovernanceHAT() public view returns(uint256) {
        if (bountyGovernanceHAT != NULL_UINT) {
            return bountyGovernanceHAT;
        } else {
            return registry.defaultBountyGovernanceHAT();
        }
    }

    /** @notice See {IHATVault-getBountyHackerHATVested}. */
    function getBountyHackerHATVested() public view returns(uint256) {
        if (bountyHackerHATVested != NULL_UINT) {
            return bountyHackerHATVested;
        } else {
            return registry.defaultBountyHackerHATVested();
        }
    }

    /** @notice See {IHATVault-getArbitrator}. */
    function getArbitrator() public view returns(address) {
        if (arbitrator != NULL_ADDRESS) {
            return arbitrator;
        } else {
            return registry.defaultArbitrator();
        }
    }

    /** @notice See {IHATVault-getChallengePeriod}. */
    function getChallengePeriod() public view returns(uint256) {
        if (challengePeriod != NULL_UINT) {
            return challengePeriod;
        } else {
            return registry.defaultChallengePeriod();
        }
    }

    /** @notice See {IHATVault-getChallengeTimeOutPeriod}. */
    function getChallengeTimeOutPeriod() public view returns(uint256) {
        if (challengeTimeOutPeriod != NULL_UINT) {
            return challengeTimeOutPeriod;
        } else {
            return registry.defaultChallengeTimeOutPeriod();
        }
    }

    /** @notice See {IHATVault-getArbitratorCanChangeBounty}. */
    function getArbitratorCanChangeBounty() public view returns(bool) {
        if (arbitratorCanChangeBounty != ArbitratorCanChangeBounty.DEFAULT) {
            return arbitratorCanChangeBounty == ArbitratorCanChangeBounty.YES;
        } else {
            return registry.defaultArbitratorCanChangeBounty();
        }
    }

    /* -------------------------------------------------------------------------------- */

    /* --------------------------------- Helpers -------------------------------------- */

    /**
    * @dev Deposit funds to the vault. Can only be called if the committee had
    * checked in and deposits are not paused.
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
            // clear withdraw request if caller deposits in her own account
            withdrawEnableStartTime[receiver] = 0;
        }

        super._deposit(caller, receiver, assets, shares);
    }

    // amount of shares correspond with assets + fee
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
        if (amount == 0) revert AmountToTransferIsZero();
        // deposit/mint/transfer
        if (to != address(0)) {
            if (registry.isEmergencyPaused()) revert SystemInEmergencyPause();
            // Cannot transfer or mint tokens to a user for which an active withdraw request exists
            // because then we would need to reset their withdraw request
            if (withdrawEnableStartTime[to] != 0) {
                IHATVaultsRegistry.GeneralParameters memory generalParameters = registry.getGeneralParameters();
                // solhint-disable-next-line not-rely-on-time
                if (block.timestamp < withdrawEnableStartTime[to] + generalParameters.withdrawRequestEnablePeriod)
                    revert CannotTransferToAnotherUserWithActiveWithdrawRequest();
            }
            rewardController.commitUserBalance(to, amount, true);
        }
        // withdraw/redeem/transfer
        if (from != address(0)) {
            if (amount > maxRedeem(from)) revert RedeemMoreThanMax();
            // if all is ok and withdrawal can be made - 
            // reset withdrawRequests[_pid][msg.sender] so that another withdrawRequest
            // will have to be made before next withdrawal
            withdrawEnableStartTime[from] = 0;

            if (!_isEmergencyWithdraw) {
                rewardController.commitUserBalance(from, amount, false);
            }
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
        IHATVaultsRegistry.GeneralParameters memory generalParameters = registry.getGeneralParameters();
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
            block.timestamp <
                withdrawEnableStartTime[_user] +
                generalParameters.withdrawRequestEnablePeriod);
    }

    /**
    * @dev calculate the specific bounty payout distribution, according to the
    * predefined bounty split and the given bounty percentage
    * @param _bountyPercentage The percentage of the vault's funds to be paid
    * out as bounty
    * @param _bountyGovernanceHAT The bountyGovernanceHAT at the time the claim was submitted
    * @param _bountyHackerHATVested The bountyHackerHATVested at the time the claim was submitted
    * @return claimBounty The bounty distribution for this specific claim
    */
    function _calcClaimBounty(
        uint256 _bountyPercentage,
        uint256 _bountyGovernanceHAT,
        uint256 _bountyHackerHATVested
    ) internal view returns(IHATVault.ClaimBounty memory claimBounty) {
        uint256 totalSupply = totalAssets();
        if (totalSupply == 0) {
          return claimBounty;
        }
        if (_bountyPercentage > maxBounty)
            revert BountyPercentageHigherThanMaxBounty();

        uint256 totalBountyAmount = totalSupply * _bountyPercentage;

        uint256 governanceHatAmount = totalBountyAmount * _bountyGovernanceHAT / HUNDRED_PERCENT_SQRD;
        uint256 hackerHatVestedAmount = totalBountyAmount * _bountyHackerHATVested / HUNDRED_PERCENT_SQRD;

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
    *   Except committee part which is capped at maximum of
    *   `MAX_COMMITTEE_BOUNTY`.
    *   Total splits should be equal to `HUNDRED_PERCENT`.
    * function will revert in case the bounty split is not legal.
    * @param _bountySplit The bounty split to check
    */
    function _validateSplit(IHATVault.BountySplit memory _bountySplit) internal pure {
        if (_bountySplit.committee > MAX_COMMITTEE_BOUNTY) revert CommitteeBountyCannotBeMoreThanMax();
        if (_bountySplit.hackerVested +
            _bountySplit.hacker +
            _bountySplit.committee != HUNDRED_PERCENT)
            revert TotalSplitPercentageShouldBeHundredPercent();
    }

    /* -------------------------------------------------------------------------------- */
}
