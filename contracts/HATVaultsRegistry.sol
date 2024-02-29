// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.16;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./tokenlock/TokenLockFactory.sol";
import "./interfaces/IHATVaultsRegistry.sol";
import "./interfaces/IHATVault.sol";

/** @title Registry to deploy Hats.finance vaults and manage shared parameters
 * @author Hats.finance
 * @notice Hats.finance is a proactive bounty protocol for white hat hackers and
 * security experts, where projects, community members, and stakeholders
 * incentivize protocol security and responsible disclosure.
 * Hats create scalable vaults using the project’s own token. The value of the
 * bounty increases with the success of the token and project.
 *
 * The owner of the registry has the permission to set time limits and bounty
 * parameters and change vaults' info, and to set the other registry roles -
 * fee setter and arbitrator.
 * The arbitrator can challenge submitted claims for bounty payouts made by
 * vaults' committees, approve them with a different bounty percentage or
 * dismiss them.
 * The fee setter can set the fee on withdrawals on all vaults.
 *
 * This project is open-source and can be found at:
 * https://github.com/hats-finance/hats-contracts
 *
 * @dev New hats.finance vaults should be created through a call to {createVault}
 * so that they are linked to the registry
 */
contract HATVaultsRegistry is IHATVaultsRegistry, Ownable {
    using SafeERC20 for IERC20;
    using Math for uint256;

    uint16 public constant HUNDRED_PERCENT = 10000;
    // the maximum percentage of the fees
    uint16 public constant MAX_GOVERNANCE_FEE = 3500;

    address public hatVaultImplementation;
    address public hatClaimsManagerImplementation;
    address[] public hatVaults;
    
    // vault address => is visible
    mapping(address => bool) public isVaultVisible;

    // PARAMETERS FOR ALL VAULTS
    IHATVaultsRegistry.GeneralParameters public generalParameters;
    ITokenLockFactory public immutable tokenLockFactory;
    
    // feeSetter sets the withdrawal fee
    address public feeSetter;

    // feeReceiver recives the governance fees from the vaults payouts
    address public governanceFeeReceiver;
 
    // the default fee percentage out of the total bounty
    uint16 public defaultGovernanceFee;

    address public defaultArbitrator;

    bool public isEmergencyPaused;
    uint32 public defaultChallengePeriod;
    uint32 public defaultChallengeTimeOutPeriod;

    /**
    * @notice initialize -
    * @param _hatVaultImplementation The hat vault implementation address.
    * @param _hatClaimsManagerImplementation The hat claims manager implementation address.
    * @param _hatGovernance The governance address.
    * @param _governanceFee The default percentage of a claim's total
    * bounty to paid as fee.  Must be less than `MAX_GOVERNANCE_FEE`.
    * @param _tokenLockFactory Address of the token lock factory to be used
    * to create a vesting contract for the approved claim reporter.
    */
    constructor(
        address _hatVaultImplementation,
        address _hatClaimsManagerImplementation,
        address _hatGovernance,
        address _defaultArbitrator,
        uint16 _governanceFee,
        address _governanceFeeReceiver,
        ITokenLockFactory _tokenLockFactory
    ) {
        _transferOwnership(_hatGovernance);
        hatVaultImplementation = _hatVaultImplementation;
        hatClaimsManagerImplementation = _hatClaimsManagerImplementation;

        if (_governanceFee > MAX_GOVERNANCE_FEE) {
            revert FeeCannotBeMoreThanMaxFee();
        }
        tokenLockFactory = _tokenLockFactory;
        generalParameters = IHATVaultsRegistry.GeneralParameters({
            hatVestingDuration: 90 days,
            hatVestingPeriods: 90,
            withdrawPeriod: 11 hours,
            safetyPeriod: 1 hours,
            setMaxBountyDelay: 2 days,
            withdrawRequestEnablePeriod: 7 days,
            withdrawRequestPendingPeriod: 7 days,
            claimFee: 0
        });

        defaultGovernanceFee = _governanceFee;
        governanceFeeReceiver = _governanceFeeReceiver;
        defaultArbitrator = _defaultArbitrator;
        defaultChallengePeriod = 3 days;
        defaultChallengeTimeOutPeriod = 125 days;
        emit RegistryCreated(
            _hatVaultImplementation,
            _hatClaimsManagerImplementation,
            address(_tokenLockFactory),
            generalParameters,
            _governanceFee,
            _governanceFeeReceiver,
            _hatGovernance,
            _defaultArbitrator,
            defaultChallengePeriod,
            defaultChallengeTimeOutPeriod
        );
    }

    /** @notice See {IHATVaultsRegistry-setVaultImplementations}. */
    function setVaultImplementations(
        address _hatVaultImplementation,
        address _hatClaimsManagerImplementation
    ) external onlyOwner {
        hatVaultImplementation = _hatVaultImplementation;
        hatClaimsManagerImplementation = _hatClaimsManagerImplementation;

        emit SetHATVaultImplementation(_hatVaultImplementation);
        emit SetHATClaimsManagerImplementation(_hatClaimsManagerImplementation);
    }

    /** @notice See {IHATVaultsRegistry-setEmergencyPaused}. */
    function setEmergencyPaused(bool _isEmergencyPaused) external onlyOwner {
        isEmergencyPaused = _isEmergencyPaused;
        emit SetEmergencyPaused(_isEmergencyPaused);
    }

    /** @notice See {IHATVaultsRegistry-logClaim}. */
    function logClaim(string calldata _descriptionHash) external payable {
        uint256 _claimFee = generalParameters.claimFee;
        if (_claimFee > 0) {
            if (msg.value < _claimFee)
                revert NotEnoughFeePaid();
            // solhint-disable-next-line avoid-low-level-calls
            (bool success,) = payable(owner()).call{value: msg.value}("");
            if (!success) revert ClaimFeeTransferFailed();
        }
        emit LogClaim(msg.sender, _descriptionHash);
    }

    /** @notice See {IHATVaultsRegistry-setDefaultGovernanceFee}. */
    function setDefaultGovernanceFee(uint16 _defaultGovernanceFee) external onlyOwner {
        if (_defaultGovernanceFee > MAX_GOVERNANCE_FEE) {
            revert FeeCannotBeMoreThanMaxFee();
        }
        defaultGovernanceFee = _defaultGovernanceFee;
        emit SetDefaultGovernanceFee(_defaultGovernanceFee);

    }
   
    /** @notice See {IHATVaultsRegistry-setDefaultArbitrator}. */
    function setDefaultArbitrator(address _defaultArbitrator) external onlyOwner {
        defaultArbitrator = _defaultArbitrator;
        emit SetDefaultArbitrator(_defaultArbitrator);
    }

    /** @notice See {IHATVaultsRegistry-setDefaultChallengePeriod}. */
    function setDefaultChallengePeriod(uint32 _defaultChallengePeriod) external onlyOwner {
        validateChallengePeriod(_defaultChallengePeriod);
        defaultChallengePeriod = _defaultChallengePeriod;
        emit SetDefaultChallengePeriod(_defaultChallengePeriod);
    }

    /** @notice See {IHATVaultsRegistry-setDefaultChallengeTimeOutPeriod}. */
    function setDefaultChallengeTimeOutPeriod(uint32 _defaultChallengeTimeOutPeriod) external onlyOwner {
        validateChallengeTimeOutPeriod(_defaultChallengeTimeOutPeriod);
        defaultChallengeTimeOutPeriod = _defaultChallengeTimeOutPeriod;
        emit SetDefaultChallengeTimeOutPeriod(_defaultChallengeTimeOutPeriod);
    }

    /** @notice See {IHATVaultsRegistry-setFeeSetter}. */
    function setFeeSetter(address _feeSetter) external onlyOwner {
        feeSetter = _feeSetter;
        emit SetFeeSetter(_feeSetter);
    }

    /** @notice See {IHATVaultsRegistry-setWithdrawRequestParams}. */
    function setWithdrawRequestParams(uint32 _withdrawRequestPendingPeriod, uint32  _withdrawRequestEnablePeriod)
        external 
        onlyOwner
    {
        if (_withdrawRequestPendingPeriod > 90 days)
            revert WithdrawRequestPendingPeriodTooLong();
        if (_withdrawRequestEnablePeriod < 6 hours)
            revert WithdrawRequestEnabledPeriodTooShort();
        if (_withdrawRequestEnablePeriod > 100 days)
            revert WithdrawRequestEnabledPeriodTooLong();
        generalParameters.withdrawRequestPendingPeriod = _withdrawRequestPendingPeriod;
        generalParameters.withdrawRequestEnablePeriod = _withdrawRequestEnablePeriod;
        emit SetWithdrawRequestParams(_withdrawRequestPendingPeriod, _withdrawRequestEnablePeriod);
    }

    /** @notice See {IHATVaultsRegistry-setClaimFee}. */
    function setClaimFee(uint256 _fee) external onlyOwner {
        generalParameters.claimFee = _fee;
        emit SetClaimFee(_fee);
    }

    /** @notice See {IHATVaultsRegistry-setWithdrawSafetyPeriod}. */
    function setWithdrawSafetyPeriod(uint32 _withdrawPeriod, uint32 _safetyPeriod) external onlyOwner { 
        if (_withdrawPeriod < 1 hours) revert WithdrawPeriodTooShort();
        if (_safetyPeriod > 6 hours) revert SafetyPeriodTooLong();
        generalParameters.withdrawPeriod = _withdrawPeriod;
        generalParameters.safetyPeriod = _safetyPeriod;
        emit SetWithdrawSafetyPeriod(_withdrawPeriod, _safetyPeriod);
    }

    /** @notice See {IHATVaultsRegistry-setHatVestingParams}. */
    function setHatVestingParams(uint32 _duration, uint32 _periods) external onlyOwner {
        if (_duration >= 180 days) revert HatVestingDurationTooLong();
        if (_periods == 0) revert HatVestingPeriodsCannotBeZero();
        if (_duration < _periods) revert HatVestingDurationSmallerThanPeriods();
        generalParameters.hatVestingDuration = _duration;
        generalParameters.hatVestingPeriods = _periods;
        emit SetHatVestingParams(_duration, _periods);
    }

    /** @notice See {IHATVaultsRegistry-setMaxBountyDelay}. */
    function setMaxBountyDelay(uint32 _delay) external onlyOwner {
        if (_delay < 2 days) revert DelayTooShort();
        generalParameters.setMaxBountyDelay = _delay;
        emit SetMaxBountyDelay(_delay);
    }

    /** @notice See {IHATVaultsRegistry-setGovernanceFeeReceiver}. */
    function setGovernanceFeeReceiver(address _governanceFeeReceiver) external onlyOwner {
        governanceFeeReceiver = _governanceFeeReceiver;
        emit SetGovernanceFeeReceiver(_governanceFeeReceiver);
    }

    /** @notice See {IHATVaultsRegistry-createVault}. */
    function createVault(
        IHATVault.VaultInitParams calldata _vaultParams,
        IHATClaimsManager.ClaimsManagerInitParams calldata _claimsManagerParams
    ) external returns(address vault, address vaultClaimsManager) {
        vault = Clones.clone(hatVaultImplementation);
        vaultClaimsManager = Clones.clone(hatClaimsManagerImplementation);

        IHATVault(vault).initialize(vaultClaimsManager, _vaultParams);
        IHATClaimsManager(vaultClaimsManager).initialize(IHATVault(vault), _claimsManagerParams);

        hatVaults.push(vault);

        emit VaultCreated(vault, vaultClaimsManager, _vaultParams, _claimsManagerParams);
    }

    /** @notice See {IHATVaultsRegistry-setVaultVisibility}. */
    function setVaultVisibility(address _vault, bool _visible) external onlyOwner {
        isVaultVisible[_vault] = _visible;
        emit SetVaultVisibility(_vault, _visible);
    }

    /** @notice See {IHATVaultsRegistry-getWithdrawPeriod}. */   
    function getWithdrawPeriod() external view returns (uint256) {
        return generalParameters.withdrawPeriod;
    }

    /** @notice See {IHATVaultsRegistry-getSafetyPeriod}. */   
    function getSafetyPeriod() external view returns (uint256) {
        return generalParameters.safetyPeriod;
    }

    /** @notice See {IHATVaultsRegistry-getWithdrawRequestEnablePeriod}. */   
    function getWithdrawRequestEnablePeriod() external view returns (uint256) {
        return generalParameters.withdrawRequestEnablePeriod;
    }

    /** @notice See {IHATVaultsRegistry-getWithdrawRequestPendingPeriod}. */   
    function getWithdrawRequestPendingPeriod() external view returns (uint256) {
        return generalParameters.withdrawRequestPendingPeriod;
    }

    /** @notice See {IHATVaultsRegistry-getSetMaxBountyDelay}. */   
    function getSetMaxBountyDelay() external view returns (uint256) {
        return generalParameters.setMaxBountyDelay;
    }

    /** @notice See {IHATVaultsRegistry-getNumberOfVaults}. */
    function getNumberOfVaults() external view returns(uint256) {
        return hatVaults.length;
    }

    function owner() public view override(IHATVaultsRegistry, Ownable) virtual returns (address) {
        return Ownable.owner();
    }

    /** @notice See {IHATVaultsRegistry-validateChallengePeriod}. */
    function validateChallengePeriod(uint32 _challengePeriod) public pure {
        if (_challengePeriod < 1 days) revert ChallengePeriodTooShort();
        if (_challengePeriod > 5 days) revert ChallengePeriodTooLong();
    }

    /** @notice See {IHATVaultsRegistry-validateChallengeTimeOutPeriod}. */
    function validateChallengeTimeOutPeriod(uint32 _challengeTimeOutPeriod) public pure {
        if (_challengeTimeOutPeriod < 2 days) revert ChallengeTimeOutPeriodTooShort();
        if (_challengeTimeOutPeriod > 125 days) revert ChallengeTimeOutPeriodTooLong();
    }
}
