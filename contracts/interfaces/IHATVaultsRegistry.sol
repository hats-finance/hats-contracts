// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.16;

import "./IHATVault.sol";
import "./IHATClaimsManager.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/** @title Interface for the Hats.finance Vault Registry
 * @author hats.finance
 * @notice The Hats.finance Vault Registry is used to deploy Hats.finance
 * vaults and manage shared parameters.
 *
 * Hats.finance is a proactive bounty protocol for white hat hackers and
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
interface IHATVaultsRegistry {

    // a struct with parameters for all vaults
    struct GeneralParameters {
        // vesting duration for the part of the bounty given to the hacker in HAT tokens
        uint32 hatVestingDuration;
        // vesting periods for the part of the bounty given to the hacker in HAT tokens
        uint32 hatVestingPeriods;
        // withdraw enable period. safetyPeriod starts when finished.
        uint32 withdrawPeriod;
        // withdraw disable period - time for the committee to gather and decide on actions,
        // withdrawals are not possible in this time. withdrawPeriod starts when finished.
        uint32 safetyPeriod;
        // period of time after withdrawRequestPendingPeriod where it is possible to withdraw
        // (after which withdrawals are not possible)
        uint32 withdrawRequestEnablePeriod;
        // period of time that has to pass after withdraw request until withdraw is possible
        uint32 withdrawRequestPendingPeriod;
        // period of time that has to pass after setting a pending max
        // bounty before it can be set as the new max bounty
        uint32 setMaxBountyDelay;
        // fee in ETH to be transferred with every logging of a claim
        uint256 claimFee;
    }

    /**
     * @notice Raised on {setWithdrawSafetyPeriod} if the withdraw period to
     * be set is shorter than 1 hour
     */
    error WithdrawPeriodTooShort();

    /**
     * @notice Raised on {setWithdrawSafetyPeriod} if the safety period to
     * be set is longer than 6 hours
     */
    error SafetyPeriodTooLong();

    /**
     * @notice Raised on {setWithdrawRequestParams} if the withdraw request
     * pending period to be set is shorter than 3 months
     */
    error WithdrawRequestPendingPeriodTooLong();

    /**
     * @notice Raised on {setWithdrawRequestParams} if the withdraw request
     * enabled period to be set is shorter than 6 hours
     */
    error WithdrawRequestEnabledPeriodTooShort();

    /**
     * @notice Raised on {setWithdrawRequestParams} if the withdraw request
     * enabled period to be set is longer than 100 days
     */
    error WithdrawRequestEnabledPeriodTooLong();

    /**
     * @notice Raised on {setHatVestingParams} if the vesting duration to be
     * set is longer than 180 days
     */
    error HatVestingDurationTooLong();

    /**
     * @notice Raised on {setHatVestingParams} if the vesting periods to be
     * set is 0
     */
    error HatVestingPeriodsCannotBeZero();
    
    /**
     * @notice Raised on {setHatVestingParams} if the vesting duration is 
     * smaller than the vesting periods
     */
    error HatVestingDurationSmallerThanPeriods();

    /**
     * @notice Raised on {setMaxBountyDelay} if the max bounty to be set is
     * shorter than 2 days
     */
    error DelayTooShort();

    /**
     * @notice Raised on {setDefaultGovernanceFee} if the fee to be set is
     * greater than 35% (defined as 3500)
     */
    error FeeCannotBeMoreThanMaxFee();

    /**
     * @notice Raised on {setDefaultChallengePeriod} if the challenge period
     *  to be set is shorter than 1 day
     */
    error ChallengePeriodTooShort();

    /**
     * @notice Raised on {setDefaultChallengePeriod} if the challenge period
     *  to be set is longer than 5 days
     */
    error ChallengePeriodTooLong();
        
    /**
     * @notice Raised on {setDefaultChallengeTimeOutPeriod} if the challenge
     * timeout period to be set is shorter than 1 day
     */
    error ChallengeTimeOutPeriodTooShort();

    /**
     * @notice Raised on {setDefaultChallengeTimeOutPeriod} if the challenge
     * timeout period to be set is longer than 125 days
     */
    error ChallengeTimeOutPeriodTooLong();
    
    /**
     * @notice Raised on {LogClaim} if the transaction was not sent with the
     * amount of ETH specified as {generalParameters.claimFee}
     */
    error NotEnoughFeePaid();

    /**
     * @notice Raised on {LogClaim} if the transfer of the claim fee failed
     */
    error ClaimFeeTransferFailed();

    /**
     * @notice Emitted on deployment of the registry
     * @param _hatVaultImplementation The HATVault implementation address
     * @param _hatClaimsManagerImplementation The HATClaimsManager implementation address
     * @param _tokenLockFactory The token lock factory address
     * @param _generalParameters The registry's general parameters
     * @param _defaultGovernanceFee The fee percentage for governance
     * @param _governanceFeeReceiver The fee receiver address
     * @param _hatGovernance The registry's governance
     * @param _defaultChallengePeriod The new default challenge period
     * @param _defaultChallengeTimeOutPeriod The new default challenge timeout
     */
    event RegistryCreated(
        address _hatVaultImplementation,
        address _hatClaimsManagerImplementation,
        address _tokenLockFactory,
        GeneralParameters _generalParameters,
        uint16 _defaultGovernanceFee,
        address _governanceFeeReceiver,
        address _hatGovernance,
        address _defaultArbitrator,
        uint256 _defaultChallengePeriod,
        uint256 _defaultChallengeTimeOutPeriod
    );

    /**
     * @notice Emitted when a claim is logged
     * @param _claimer The address of the claimer
     * @param _descriptionHash - a hash of an ipfs encrypted file which
     * describes the claim.
     */
    event LogClaim(address indexed _claimer, string _descriptionHash);

    /**
     * @notice Emitted when a new fee setter is set
     * @param _feeSetter The address of the new fee setter
     */
    event SetFeeSetter(address indexed _feeSetter);

    /**
     * @notice Emitted when new withdraw request time limits are set
     * @param _withdrawRequestPendingPeriod Time period where the withdraw
     * request is pending
     * @param _withdrawRequestEnablePeriod Time period after the peding period
     * has ended during which withdrawal is enabled
     */
    event SetWithdrawRequestParams(
        uint256 _withdrawRequestPendingPeriod,
        uint256 _withdrawRequestEnablePeriod
    );

    /**
     * @notice Emitted when a new fee for logging a claim for a bounty is set
     * @param _fee Claim fee in ETH to be transferred on any call of {logClaim}
     */
    event SetClaimFee(uint256 _fee);

    /**
     * @notice Emitted when new durations are set for withdraw period and
     * safety period
     * @param _withdrawPeriod Amount of time during which withdrawals are
     * enabled, and the bounty split can be changed by the governance
     * @param _safetyPeriod Amount of time during which claims for bounties 
     * can be submitted and withdrawals are disabled
     */
    event SetWithdrawSafetyPeriod(
        uint256 _withdrawPeriod,
        uint256 _safetyPeriod
    );

    /**
     * @notice Emitted when new HAT vesting parameters are set
     * @param _duration The duration of the vesting period
     * @param _periods The number of vesting periods
     */
    event SetHatVestingParams(uint256 _duration, uint256 _periods);

    /**
     * @notice Emitted when a new timelock delay for setting the
     * max bounty is set
     * @param _delay The time period for the delay
     */
    event SetMaxBountyDelay(uint256 _delay);

    /**
     * @notice Emitted when a new fee receiver address is set
     * @param _governaceFeeReceiver The receiver of the fee from the payouts of the vaults
     */
    event SetGovernanceFeeReceiver(address indexed _governaceFeeReceiver);

    /**
     * @notice Emitted when the UI visibility of a vault is changed
     * @param _vault The address of the vault to update
     * @param _visible Is this vault visible in the UI
     */
    event SetVaultVisibility(address indexed _vault, bool indexed _visible);

    /** @dev Emitted when a new vault is created
     * @param _vault The address of the vault to add to the registry
     * @param _claimsManager The address of the vault's claims manager
     * @param _vaultParams The vault initialization parameters
     * @param _claimsManagerParams The vault's claims manager initialization parameters
     */
    event VaultCreated(
        address indexed _vault,
        address indexed _claimsManager,
        IHATVault.VaultInitParams _vaultParams,
        IHATClaimsManager.ClaimsManagerInitParams _claimsManagerParams
    );

    /**
     * @notice Emitted when a new default governance fee is set
     * @param _defaultGovernanceFee The new default fee part sent to governance
     */
    event SetDefaultGovernanceFee(uint16 _defaultGovernanceFee);

    /**
     * @notice Emitted when a new default arbitrator is set
     * @param _defaultArbitrator The address of the new arbitrator
     */
    event SetDefaultArbitrator(address indexed _defaultArbitrator);

    /**
     * @notice Emitted when a new default challenge period is set
     * @param _defaultChallengePeriod The new default challenge period
     */ 
    event SetDefaultChallengePeriod(uint256 _defaultChallengePeriod);

    /**
     * @notice Emitted when a new default challenge timeout period is set
     * @param _defaultChallengeTimeOutPeriod The new default challenge timeout
     * period
     */
    event SetDefaultChallengeTimeOutPeriod(uint256 _defaultChallengeTimeOutPeriod);

    /** @notice Emitted when the system is put into emergency pause/unpause
     * @param _isEmergencyPaused Is the system in an emergency pause
     */
    event SetEmergencyPaused(bool _isEmergencyPaused);

    /**
     * @notice Emitted when a new HATVault implementation is set
     * @param _hatVaultImplementation The address of the new HATVault implementation
     */
    event SetHATVaultImplementation(address indexed _hatVaultImplementation);

    /**
     * @notice Emitted when a new HATClaimsManager implementation is set
     * @param _hatClaimsManagerImplementation The address of the new HATClaimsManager implementation
     */
    event SetHATClaimsManagerImplementation(address indexed _hatClaimsManagerImplementation);

    /**
     * @notice Called by governance to pause/unpause the system in case of an
     * emergency
     * @param _isEmergencyPaused Is the system in an emergency pause
     */
    function setEmergencyPaused(bool _isEmergencyPaused) external;

    /**
     * @notice Called by governance to set a new HATVault and HATVault implementation to be
     * used by the registry for creating new vaults
     * @param _hatVaultImplementation The address of the HATVault implementation
     * @param _hatClaimsManagerImplementation The address of the HATClaimsManager implementation
     */
    function setVaultImplementations(address _hatVaultImplementation, address _hatClaimsManagerImplementation) external;

    /**
     * @notice Emit an event that includes the given _descriptionHash
     * This can be used by the claimer as evidence that she had access to the
     * information at the time of the call
     * if a {generalParameters.claimFee} > 0, the caller must send that amount
     * of ETH for the claim to succeed
     * @param _descriptionHash - a hash of an IPFS encrypted file which 
     * describes the claim.
     */
    function logClaim(string calldata _descriptionHash) external payable;

    /**
     * @notice Called by governance to set the default fee percentage
     * @param _defaultGovernanceFee The fee for governance
     */
    function setDefaultGovernanceFee(uint16 _defaultGovernanceFee) external;

    /**
     * @notice Called by governance to set the default arbitrator.
     * @param _defaultArbitrator The default arbitrator address
     */
    function setDefaultArbitrator(address _defaultArbitrator) external;

    /**
     * @notice Called by governance to set the default challenge period
     * @param _defaultChallengePeriod The default challenge period
     */
    function setDefaultChallengePeriod(uint32 _defaultChallengePeriod) 
        external;

    /**
     * @notice Called by governance to set the default challenge timeout
     * @param _defaultChallengeTimeOutPeriod The Default challenge timeout
     */
    function setDefaultChallengeTimeOutPeriod(
        uint32 _defaultChallengeTimeOutPeriod
    ) 
        external;

    /**
     * @notice Check that the given challenge period is legal, meaning that it
     * is greater than 1 day and less than 5 days.
     * @param _challengePeriod The challenge period to check
     */
    function validateChallengePeriod(uint32 _challengePeriod) external pure;

    /**
     * @notice Check that the given challenge timeout period is legal, meaning
     * that it is greater than 2 days and less than 125 days.
     * @param _challengeTimeOutPeriod The challenge timeout period to check
     */
    function validateChallengeTimeOutPeriod(uint32 _challengeTimeOutPeriod) external pure;
   
    /**
     * @notice Called by governance to set the fee setter role
     * @param _feeSetter Address of new fee setter
     */
    function setFeeSetter(address _feeSetter) external;

    /**
     * @notice Called by governance to set time limits for withdraw requests
     * @param _withdrawRequestPendingPeriod Time period where the withdraw
     * request is pending
     * @param _withdrawRequestEnablePeriod Time period after the peding period
     * has ended during which withdrawal is enabled
     */
    function setWithdrawRequestParams(
        uint32 _withdrawRequestPendingPeriod,
        uint32  _withdrawRequestEnablePeriod
    )
        external;

    /**
     * @notice Called by governance to set the fee for logging a claim for a
     * bounty in any vault.
     * @param _fee Claim fee in ETH to be transferred on any call of
     * {logClaim}
     */
    function setClaimFee(uint256 _fee) external;

    /**
     * @notice Called by governance to set the withdraw period and safety
     * period, which are always interchanging.
     * The safety period is time that the committee can submit claims for 
     * bounty payouts, and during which withdrawals are disabled and the
     * bounty split cannot be changed.
     * @param _withdrawPeriod Amount of time during which withdrawals are
     * enabled, and the bounty split can be changed by the governance. Must be
     * at least 1 hour.
     * @param _safetyPeriod Amount of time during which claims for bounties 
     * can be submitted and withdrawals are disabled. Must be at most 6 hours.
     */
    function setWithdrawSafetyPeriod(
        uint32 _withdrawPeriod,
        uint32 _safetyPeriod
    ) 
        external;

    /**
     * @notice Called by governance to set vesting params for rewarding hackers
     * with rewardToken, for all vaults
     * @param _duration Duration of the vesting period. Must be less than 180
     * days.
     * @param _periods The number of vesting periods. Must be more than 0 and 
     * less then the vesting duration.
     */
    function setHatVestingParams(uint32 _duration, uint32 _periods) external;

    /**
     * @notice Called by governance to set the timelock delay for setting the
     * max bounty (the time between setPendingMaxBounty and setMaxBounty)
     * @param _delay The time period for the delay. Must be at least 2 days.
     */
    function setMaxBountyDelay(uint32 _delay) external;

    /**
     * @notice Called by governance to set the fee receiver address
     * @param _governanceFeeReceiver The receiver of the fees from the payouts of the vaults
     */
    function setGovernanceFeeReceiver(address _governanceFeeReceiver) external;

    /**
     * @notice Create a new vault
     * NOTE: Vaults should not use tokens which do not guarantee that the 
     * amount specified is the amount transferred
     * @param _vaultParams The vault initialization parameters
     * @param _vaultParams The vault token initialization parameters
     * @return vault The address of the new vault
     */
    function createVault(
        IHATVault.VaultInitParams calldata _vaultParams,
        IHATClaimsManager.ClaimsManagerInitParams calldata _claimsManagerParams
    ) external returns(address vault, address vaultClaimsManager);

    /**
     * @notice Called by governance to change the UI visibility of a vault
     * @param _vault The address of the vault to update
     * @param _visible Is this vault visible in the UI
     * This parameter can be used by the UI to include or exclude the vault
     */
    function setVaultVisibility(address _vault, bool _visible) external;

    /**
     * @notice Returns the withdraw enable period for all vaults. The safety
     * period starts when finished.
     * @return Withdraw enable period for all vaults
     */
    function getWithdrawPeriod() external view returns (uint256);

    /**
     * @notice Returns the withdraw disable period - time for the committee to
     * gather and decide on actions, withdrawals are not possible in this
     * time. The withdraw period starts when finished.
     * @return Safety period for all vaults
     */
    function getSafetyPeriod() external view returns (uint256);

    /**
     * @notice Returns the withdraw request enable period for all vaults -
     * period of time after withdrawRequestPendingPeriod where it is possible
     * to withdraw, and after which withdrawals are not possible.
     * @return Withdraw request enable period for all vaults
     */
    function getWithdrawRequestEnablePeriod() external view returns (uint256);

    /**
     * @notice Returns the withdraw request pending period for all vaults -
     * period of time that has to pass after withdraw request until withdraw
     * is possible
     * @return Withdraw request pending period for all vaults
     */
    function getWithdrawRequestPendingPeriod() external view returns (uint256);

    /**
     * @notice Returns the set max bounty delay for all vaults - period of
     * time that has to pass after setting a pending max bounty before it can
     * be set as the new max bounty
     * @return Set max bounty delay for all vaults
     */
    function getSetMaxBountyDelay() external view returns (uint256);

    /**
     * @notice Returns the number of vaults that have been previously created
     * @return The number of vaults in the registry
     */
    function getNumberOfVaults() external view returns(uint256);

    /**
     * @notice Get the fee setter address
     * @return The address of the fee setter
     */
    function feeSetter() external view returns(address);

    /**
     * @notice Get the fee receiver address
     * @return The address of the fee receiver
     */
    function governanceFeeReceiver() external view returns(address);

    /**
     * @notice Get whether the system is in an emergency pause
     * @return Whether the system is in an emergency pause
     */
    function isEmergencyPaused() external view returns(bool);

    /**
     * @notice Get the owner address
     * @return The address of the owner
     */
    function owner() external view returns(address);

    /**
     * @notice Get the default fee percentage of the total bounty
     * @return The default fee percentage of the total bounty
     */
    function defaultGovernanceFee() external view returns(uint16);

    /**
     * @notice Get the default arbitrator address
     * @return The default arbitrator address
     */
    function defaultArbitrator() external view returns(address);

    /**
     * @notice Get the default challenge period
     * @return The default challenge period
     */
    function defaultChallengePeriod() external view returns(uint32);

    /**
     * @notice Get the default challenge time out period
     * @return The default challenge time out period
     */
    function defaultChallengeTimeOutPeriod() external view returns(uint32);

    /**
     * @notice Get the max governance fee
     * @return The max governance fee
     */
    function MAX_GOVERNANCE_FEE() external view returns(uint16);
}
