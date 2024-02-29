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
import "./interfaces/IHATClaimsManager.sol";
import "./interfaces/IRewardController.sol";
import "./HATVaultsRegistry.sol";

/** @title A Hats.finance claims manager which manages claims for a specific project's HATVault
* @author Hats.finance
* @notice The HATClaimsManager manages the bounty payouts from the HATVault of a project.
* When a bug is submitted and approved, the bounty is paid out using the
* funds in the project's HATVault. Bounties are paid out as a
* percentage of the vault. The percentage is set according to the severity of
* the bug. Vaults have regular safety periods (typically for an hour twice a
* day) which are time for the committee to submit a new claim.
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
contract HATClaimsManager is IHATClaimsManager, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;
    using MathUpgradeable for uint256;

    string public constant VERSION = "3.0";
    uint16 public constant NULL_UINT16 = type(uint16).max;
    uint32 public constant NULL_UINT32 = type(uint32).max;
    address public constant NULL_ADDRESS = 0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF;
    uint256 public constant HUNDRED_PERCENT = 1e4;
    uint256 public constant HUNDRED_PERCENT_SQRD = 1e8;
    uint256 public constant MAX_BOUNTY_LIMIT = 90e2; // Max bounty, can be up to 90%
    uint256 public constant MAX_COMMITTEE_BOUNTY = 10e2; // Max committee bounty can be up to 10%

    IHATVaultsRegistry public registry;
    IHATVault public vault;
    ITokenLockFactory public tokenLockFactory;

    Claim public activeClaim;

    IHATClaimsManager.BountySplit public bountySplit;
    uint16 public maxBounty;
    uint32 public vestingDuration;
    uint32 public vestingPeriods;
    address public committee;

    bool public committeeCheckedIn;

    uint256 internal nonce;

    PendingMaxBounty public pendingMaxBounty;

    // the fee percentage of the total bounty to be paid to the governance
    uint16 internal governanceFee;

    // address of the arbitrator - which can dispute claims and override the committee's decisions
    address internal arbitrator;
    // time during which a claim can be challenged by the arbitrator
    uint32 internal challengePeriod;
    // time after which a challenged claim is automatically dismissed
    uint32 internal challengeTimeOutPeriod;
    // whether the arbitrator can change bounty of claims
    bool public arbitratorCanChangeBounty;
    // whether the arbitrator can change the beneficiary of claims
    bool public arbitratorCanChangeBeneficiary;
    // whether the arbitrator can submit claims
    bool public arbitratorCanSubmitClaims;
    // Can the committee revoke the token lock
    bool public isTokenLockRevocable;

    modifier onlyRegistryOwner() {
        if (registry.owner() != msg.sender) revert OnlyRegistryOwner();
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
        uint256 _withdrawPeriod = registry.getWithdrawPeriod();
        // disable withdraw for safetyPeriod (e.g 1 hour) after each withdrawPeriod(e.g 11 hours)
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp % (_withdrawPeriod + registry.getSafetyPeriod()) >= _withdrawPeriod)
            revert SafetyPeriod();
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

    /** @notice See {IHATClaimsManager-initialize}. */
    function initialize(IHATVault _vault, IHATClaimsManager.ClaimsManagerInitParams calldata _params) external initializer {
        if (_params.maxBounty > MAX_BOUNTY_LIMIT && _params.maxBounty != HUNDRED_PERCENT)
            revert MaxBountyCannotBeMoreThanMaxBountyLimit();
        HATVaultsRegistry _registry = HATVaultsRegistry(msg.sender);
        if (_params.governanceFee > _registry.MAX_GOVERNANCE_FEE() && _params.governanceFee != NULL_UINT16)
            revert FeeCannotBeMoreThanMaxFee();
        _validateSplit(_params.bountySplit);
        _setVestingParams(_params.vestingDuration, _params.vestingPeriods);
        maxBounty = _params.maxBounty;
        bountySplit = _params.bountySplit;
        governanceFee = _params.governanceFee;
        committee = _params.committee;
        registry = _registry;
        vault = _vault;
        __ReentrancyGuard_init();
        _transferOwnership(_params.owner);
        tokenLockFactory = _registry.tokenLockFactory();
        arbitrator = _params.arbitrator;
        arbitratorCanChangeBounty = _params.arbitratorCanChangeBounty;
        arbitratorCanChangeBeneficiary = _params.arbitratorCanChangeBeneficiary;
        arbitratorCanSubmitClaims = _params.arbitratorCanSubmitClaims;
        isTokenLockRevocable = _params.isTokenLockRevocable;

        // Set vault to use default registry values where applicable
        challengePeriod = NULL_UINT32;
        challengeTimeOutPeriod = NULL_UINT32;
    }


    /* ---------------------------------- Claim --------------------------------------- */

    /** @notice See {IHATClaimsManager-submitClaim}. */
    function submitClaim(address _beneficiary, uint16 _bountyPercentage, string calldata _descriptionHash)
        external noActiveClaim notEmergencyPaused returns (bytes32 claimId) {
        address arbitratorAddress = getArbitrator();
        if (!arbitratorCanSubmitClaims || arbitratorAddress != msg.sender)
            if (committee != msg.sender) revert OnlyCommittee();
        IHATVaultsRegistry _registry = registry;
        uint256 withdrawPeriod = _registry.getWithdrawPeriod();
        // require we are in safetyPeriod
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp % (withdrawPeriod + _registry.getSafetyPeriod()) < withdrawPeriod)
            revert NotSafetyPeriod();
        if (_bountyPercentage > maxBounty)
            revert BountyPercentageHigherThanMaxBounty();

        if (maxBounty == HUNDRED_PERCENT && _bountyPercentage != HUNDRED_PERCENT && _bountyPercentage > MAX_BOUNTY_LIMIT)
            revert PayoutMustBeUpToMaxBountyLimitOrHundredPercent();

        claimId = keccak256(abi.encodePacked(address(this), ++nonce));
        activeClaim = Claim({
            claimId: claimId,
            beneficiary: _beneficiary,
            bountyPercentage: _bountyPercentage,
            committee: committee,
            // solhint-disable-next-line not-rely-on-time
            createdAt: uint32(block.timestamp),
            challengedAt: 0,
            governanceFee: getGovernanceFee(),
            arbitrator: arbitratorAddress,
            challengePeriod: getChallengePeriod(),
            challengeTimeOutPeriod: getChallengeTimeOutPeriod(),
            arbitratorCanChangeBounty: arbitratorCanChangeBounty,
            arbitratorCanChangeBeneficiary: arbitratorCanChangeBeneficiary
        });

        vault.setWithdrawPaused(true);

        emit SubmitClaim(
            claimId,
            committee,
            msg.sender,
            _beneficiary,
            _bountyPercentage,
            _descriptionHash
        );
    }

    function challengeClaim(bytes32 _claimId) external isActiveClaim(_claimId) {
        if (msg.sender != activeClaim.arbitrator && msg.sender != registry.owner())
            revert OnlyArbitratorOrRegistryOwner();
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp >= activeClaim.createdAt + activeClaim.challengePeriod)
            revert ChallengePeriodEnded();
        if (activeClaim.challengedAt != 0) {
            revert ClaimAlreadyChallenged();
        } 
        // solhint-disable-next-line not-rely-on-time
        activeClaim.challengedAt = uint32(block.timestamp);
        emit ChallengeClaim(_claimId);
    }

    /** @notice See {IHATClaimsManager-approveClaim}. */
    function approveClaim(bytes32 _claimId, uint16 _bountyPercentage, address _beneficiary) external nonReentrant isActiveClaim(_claimId) {
        Claim memory _claim = activeClaim;
        delete activeClaim;
        
        
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp >= _claim.createdAt + _claim.challengePeriod + _claim.challengeTimeOutPeriod) {
            // cannot approve an expired claim
            revert ClaimExpired();
        } 
        if (_claim.challengedAt != 0) {
            // the claim was challenged, and only the arbitrator can approve it, within the timeout period
            if (
                msg.sender != _claim.arbitrator ||
                // solhint-disable-next-line not-rely-on-time
                block.timestamp >= _claim.challengedAt + _claim.challengeTimeOutPeriod
            )
                revert ChallengedClaimCanOnlyBeApprovedByArbitratorUntilChallengeTimeoutPeriod();
            // the arbitrator can update the bounty if needed
            if (_claim.arbitratorCanChangeBounty && _bountyPercentage != 0) {
                _claim.bountyPercentage = _bountyPercentage;
            }

            if (_claim.arbitratorCanChangeBeneficiary && _beneficiary != address(0)) {
                _claim.beneficiary = _beneficiary;
            }
        } else {
            // the claim can be approved by anyone if the challengePeriod passed without a challenge
            if (
                // solhint-disable-next-line not-rely-on-time
                block.timestamp <= _claim.createdAt + _claim.challengePeriod
            ) 
                revert UnchallengedClaimCanOnlyBeApprovedAfterChallengePeriod();
        }

        vault.setWithdrawPaused(false);

        if (_claim.bountyPercentage == HUNDRED_PERCENT) {
            vault.destroyVault();
        }

        address tokenLock;

        IHATClaimsManager.ClaimBounty memory claimBounty = _calcClaimBounty(_claim.bountyPercentage, _claim.governanceFee);

        vault.makePayout(
            claimBounty.committee +
            claimBounty.governanceFee +
            claimBounty.hacker +
            claimBounty.hackerVested
        );

        IERC20 _asset = IERC20(vault.asset());
        if (claimBounty.hackerVested > 0) {
            //hacker gets part of bounty to a vesting contract
            tokenLock = tokenLockFactory.createTokenLock(
                address(_asset),
                isTokenLockRevocable ? committee : 0x0000000000000000000000000000000000000000, // owner
                _claim.beneficiary,
                claimBounty.hackerVested,
                // solhint-disable-next-line not-rely-on-time
                block.timestamp, //start
                // solhint-disable-next-line not-rely-on-time
                block.timestamp + vestingDuration, //end
                vestingPeriods,
                0, //no release start
                0, //no cliff
                isTokenLockRevocable,
                false
            );
            _asset.safeTransfer(tokenLock, claimBounty.hackerVested);
        }

        _asset.safeTransfer(_claim.beneficiary, claimBounty.hacker);
        _asset.safeTransfer(_claim.committee, claimBounty.committee);

        _asset.safeTransfer(registry.governanceFeeReceiver(), claimBounty.governanceFee);

        emit ApproveClaim(
            _claimId,
            _claim.committee,
            msg.sender,
            _claim.beneficiary,
            _claim.bountyPercentage,
            tokenLock,
            claimBounty
        );
    }

    /** @notice See {IHATClaimsManager-dismissClaim}. */
    function dismissClaim(bytes32 _claimId) external isActiveClaim(_claimId) {
        uint256 _challengeTimeOutPeriod = activeClaim.challengeTimeOutPeriod;
        uint256 _challengedAt = activeClaim.challengedAt;
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp <= activeClaim.createdAt + activeClaim.challengePeriod + _challengeTimeOutPeriod) {
            if (_challengedAt == 0) revert OnlyCallableIfChallenged();
            if (
                // solhint-disable-next-line not-rely-on-time
                block.timestamp <= _challengedAt + _challengeTimeOutPeriod && 
                msg.sender != activeClaim.arbitrator
            ) revert OnlyCallableByArbitratorOrAfterChallengeTimeOutPeriod();
        } // else the claim is expired and should be dismissed
        delete activeClaim;

        vault.setWithdrawPaused(false);

        emit DismissClaim(_claimId);
    }
    /* -------------------------------------------------------------------------------- */

    /* ---------------------------------- Params -------------------------------------- */

    /** @notice See {IHATClaimsManager-setCommittee}. */
    function setCommittee(address _committee) external {
        // vault owner can update committee only if committee was not checked in yet.
        if (msg.sender == owner() && committee != msg.sender) {
            if (committeeCheckedIn)
                revert CommitteeAlreadyCheckedIn();
        } else {
            if (committee != msg.sender) revert OnlyCommittee();
        }

        committee = _committee;

        emit SetCommittee(_committee);
    }

    /** @notice See {IHATClaimsManager-setVestingParams}. */
    function setVestingParams(uint32 _duration, uint32 _periods) external onlyOwner {
        _setVestingParams(_duration, _periods);
    }

    /** @notice See {IHATClaimsManager-setBountySplit}. */
    function setBountySplit(IHATClaimsManager.BountySplit calldata _bountySplit) external onlyOwner noActiveClaim noSafetyPeriod {
        _validateSplit(_bountySplit);
        bountySplit = _bountySplit;
        emit SetBountySplit(_bountySplit);
    }

    /** @notice See {IHATClaimsManager-committeeCheckIn}. */
    function committeeCheckIn() external onlyCommittee {
        committeeCheckedIn = true;
        vault.startVault();
        emit CommitteeCheckedIn();
    }

    /** @notice See {IHATClaimsManager-setPendingMaxBounty}. */
    function setPendingMaxBounty(uint16 _maxBounty) external onlyOwner noActiveClaim {
        if (_maxBounty > MAX_BOUNTY_LIMIT && _maxBounty != HUNDRED_PERCENT)
            revert MaxBountyCannotBeMoreThanMaxBountyLimit();
        pendingMaxBounty.maxBounty = _maxBounty;
        // solhint-disable-next-line not-rely-on-time
        pendingMaxBounty.timestamp = uint32(block.timestamp);
        emit SetPendingMaxBounty(_maxBounty);
    }

    /** @notice See {IHATClaimsManager-setMaxBounty}. */
    function setMaxBounty() external onlyOwner noActiveClaim {
        PendingMaxBounty memory _pendingMaxBounty = pendingMaxBounty;
        if (_pendingMaxBounty.timestamp == 0) revert NoPendingMaxBounty();

        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp - _pendingMaxBounty.timestamp < registry.getSetMaxBountyDelay())
            revert DelayPeriodForSettingMaxBountyHadNotPassed();

        uint16 _maxBounty = pendingMaxBounty.maxBounty;
        maxBounty = _maxBounty;
        delete pendingMaxBounty;
        emit SetMaxBounty(_maxBounty);
    }
    
    /** @notice See {IHATClaimsManager-setGoveranceFee}. */
    function setGovernanceFee(uint16 _governanceFee) external onlyRegistryOwner {
        if (_governanceFee > registry.MAX_GOVERNANCE_FEE() && _governanceFee != NULL_UINT16) {
            revert FeeCannotBeMoreThanMaxFee();
        }

        governanceFee = _governanceFee;

        emit SetGovernanceFee(_governanceFee);
    }

    /** @notice See {IHATClaimsManager-setArbitrator}. */
    function setArbitrator(address _arbitrator) external onlyRegistryOwner {
        arbitrator = _arbitrator;
        emit SetArbitrator(_arbitrator);
    }

    /** @notice See {IHATClaimsManager-setChallengePeriod}. */
    function setChallengePeriod(uint32 _challengePeriod) external onlyRegistryOwner {
        if (_challengePeriod != NULL_UINT32) {
            registry.validateChallengePeriod(_challengePeriod);
        }

        challengePeriod = _challengePeriod;

        emit SetChallengePeriod(_challengePeriod);
    }

    /** @notice See {IHATClaimsManager-setChallengeTimeOutPeriod}. */
    function setChallengeTimeOutPeriod(uint32 _challengeTimeOutPeriod) external onlyRegistryOwner {
        if (_challengeTimeOutPeriod != NULL_UINT32) {
            registry.validateChallengeTimeOutPeriod(_challengeTimeOutPeriod);
        }

        challengeTimeOutPeriod = _challengeTimeOutPeriod;

        emit SetChallengeTimeOutPeriod(_challengeTimeOutPeriod);
    }

    /** @notice See {IHATClaimsManager-setArbitratorOptions}. */
    function setArbitratorOptions(
        bool _arbitratorCanChangeBounty,
        bool _arbitratorCanChangeBeneficiary,
        bool _arbitratorCanSubmitClaims
    ) external onlyRegistryOwner {
        arbitratorCanChangeBounty = _arbitratorCanChangeBounty;
        arbitratorCanChangeBeneficiary = _arbitratorCanChangeBeneficiary;
        arbitratorCanSubmitClaims = _arbitratorCanSubmitClaims;
        emit SetArbitratorOptions(
            _arbitratorCanChangeBounty,
            _arbitratorCanChangeBeneficiary,
            _arbitratorCanSubmitClaims
        );
    }

    /* -------------------------------------------------------------------------------- */

    /* --------------------------------- Getters -------------------------------------- */

    /** @notice See {IHATClaimsManager-getGovernanceFee}. */
    function getGovernanceFee() public view returns(uint16) {
        uint16 _getGovernanceFee = governanceFee;
        if (_getGovernanceFee != NULL_UINT16) {
            return _getGovernanceFee;
        } else {
            return registry.defaultGovernanceFee();
        }
    }

    /** @notice See {IHATClaimsManager-getArbitrator}. */
    function getArbitrator() public view returns(address) {
        address _arbitrator = arbitrator;
        if (_arbitrator != NULL_ADDRESS) {
            return _arbitrator;
        } else {
            return registry.defaultArbitrator();
        }
    }

    /** @notice See {IHATClaimsManager-getChallengePeriod}. */
    function getChallengePeriod() public view returns(uint32) {
        uint32 _challengePeriod = challengePeriod;
        if (_challengePeriod != NULL_UINT32) {
            return _challengePeriod;
        } else {
            return registry.defaultChallengePeriod();
        }
    }

    /** @notice See {IHATClaimsManager-getChallengeTimeOutPeriod}. */
    function getChallengeTimeOutPeriod() public view returns(uint32) {
        uint32 _challengeTimeOutPeriod = challengeTimeOutPeriod;
        if (_challengeTimeOutPeriod != NULL_UINT32) {
            return _challengeTimeOutPeriod;
        } else {
            return registry.defaultChallengeTimeOutPeriod();
        }
    }

    /** @notice See {IHATClaimsManager-getActiveClaim}. */
    function getActiveClaim() public view returns(Claim memory) {
        return activeClaim;
    }

    /* -------------------------------------------------------------------------------- */

    /* --------------------------------- Helpers -------------------------------------- */

    function _setVestingParams(uint32 _duration, uint32 _periods) internal {
        if (_duration > 120 days) revert VestingDurationTooLong();
        if (_periods == 0) revert VestingPeriodsCannotBeZero();
        if (_duration < _periods) revert VestingDurationSmallerThanPeriods();
        vestingDuration = _duration;
        vestingPeriods = _periods;
        emit SetVestingParams(_duration, _periods);
    }

    /**
    * @dev calculate the specific bounty payout distribution, according to the
    * predefined bounty split and the given bounty percentage
    * @param _bountyPercentage The percentage of the vault's funds to be paid
    * out as bounty
    * @param _governanceFee The governanceFee at the time the claim was submitted
    * @return claimBounty The bounty distribution for this specific claim
    */
    function _calcClaimBounty(
        uint16 _bountyPercentage,
        uint16 _governanceFee
    ) internal view returns(IHATClaimsManager.ClaimBounty memory claimBounty) {
        uint256 _totalAssets = vault.totalAssets();
        if (_totalAssets == 0) {
          return claimBounty;
        }
        if (_bountyPercentage > maxBounty)
            revert BountyPercentageHigherThanMaxBounty();
        if (maxBounty == HUNDRED_PERCENT && _bountyPercentage != HUNDRED_PERCENT && _bountyPercentage > MAX_BOUNTY_LIMIT)
            revert PayoutMustBeUpToMaxBountyLimitOrHundredPercent();

        uint256 _totalBountyAmount = _totalAssets * _bountyPercentage;

        uint256 _governanceFeeAmount = _totalBountyAmount.mulDiv(_governanceFee, HUNDRED_PERCENT_SQRD);

        _totalBountyAmount -= _governanceFeeAmount * HUNDRED_PERCENT;

        claimBounty.governanceFee = _governanceFeeAmount;

        uint256 _hackerVestedAmount = _totalBountyAmount.mulDiv(bountySplit.hackerVested, HUNDRED_PERCENT_SQRD);
        uint256 _hackerAmount = _totalBountyAmount.mulDiv(bountySplit.hacker, HUNDRED_PERCENT_SQRD);

        _totalBountyAmount -= (_hackerVestedAmount + _hackerAmount) * HUNDRED_PERCENT;

        claimBounty.hackerVested = _hackerVestedAmount;
        claimBounty.hacker = _hackerAmount;

        // give all the tokens left to the committee to avoid rounding errors
        claimBounty.committee = _totalBountyAmount / HUNDRED_PERCENT;
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
    function _validateSplit(IHATClaimsManager.BountySplit calldata _bountySplit) internal pure {
        if (_bountySplit.committee > MAX_COMMITTEE_BOUNTY) revert CommitteeBountyCannotBeMoreThanMax();
        if (_bountySplit.hackerVested +
            _bountySplit.hacker +
            _bountySplit.committee != HUNDRED_PERCENT)
            revert TotalSplitPercentageShouldBeHundredPercent();
    }

    /* -------------------------------------------------------------------------------- */
}
