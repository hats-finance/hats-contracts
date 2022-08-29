// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.16;

import "./IRewardController.sol";
import "./IHATVault.sol";

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
        uint256 hatVestingDuration;
        // vesting periods for the part of the bounty given to the hacker in HAT tokens
        uint256 hatVestingPeriods;
        // withdraw enable period. safetyPeriod starts when finished.
        uint256 withdrawPeriod;
        // withdraw disable period - time for the committee to gather and decide on actions,
        // withdrawals are not possible in this time. withdrawPeriod starts when finished.
        uint256 safetyPeriod;
        // period of time after withdrawRequestPendingPeriod where it is possible to withdraw
        // (after which withdrawals are not possible)
        uint256 withdrawRequestEnablePeriod;
        // period of time that has to pass after withdraw request until withdraw is possible
        uint256 withdrawRequestPendingPeriod;
        // period of time that has to pass after setting a pending max
        // bounty before it can be set as the new max bounty
        uint256 setMaxBountyDelay;
        // fee in ETH to be transferred with every logging of a claim
        uint256 claimFee;  
    }

    // How to divide the HAT part of bounties, in percentages (out of {HUNDRED_PERCENT})
    // The precentages are taken from the total bounty
    struct HATBountySplit {
        // the percentage of the total bounty to be swapped to HATs and sent to governance
        uint256 governanceHat;
        // the percentage of the total bounty to be swapped to HATs and sent to the hacker via vesting contract
        uint256 hackerHatVested;
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
     * @notice Raised on {swapAndSend} if the amount to swap is zero
     */
    error AmountToSwapIsZero();

    /**
     * @notice Raised on {swapAndSend} if the swap was not successful
     */
    error SwapFailed();
    // Wrong amount received

    /**
     * @notice Raised on {swapAndSend} if the amount that was recieved in
     * the swap was less than the minimum amount specified
     */
    error AmountSwappedLessThanMinimum();

    /**
     * @notice Raised on {setDefaultHATBountySplit} if the split to be set is
     * greater than 100% (defined as 10000)
     */
    error TotalHatsSplitPercentageShouldBeLessThanHundredPercent();

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
     * timeout period to be set is longer than 85 days
     */
    error ChallengeTimeOutPeriodTooLong();
    
    /**
     * @notice Raised on {LogClaim} if the transaction was not sent with the
     * amount of ETH specified as {generalParameters.claimFee}
     */
    error NotEnoughFeePaid();

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
     * @notice Emitted when the UI visibility of a vault is changed
     * @param _vault The address of the vault to update
     * @param _visible Is this vault visible in the UI
     */
    event SetVaultVisibility(address indexed _vault, bool indexed _visible);

    /** @dev Emitted when a new vault is created
     * @param _vault The address of the vault to add to the registry
     * @param _asset The vault's native token
     * @param _committee The address of the vault's committee 
     * @param _rewardController The reward controller for the vault
     * @param _maxBounty The maximum percentage of the vault that can be paid
     * out as a bounty. Must be between 0 and 100% (defined as 10000)
     * @param _bountySplit The way to split the bounty between the hacker, 
     * hacker vested, and committee.
     *   Each entry is a number between 0 and 100%
     *   Total splits should be equal to 100%
     * @param _descriptionHash Hash of the vault description.
     * @param _bountyVestingDuration The duration of the vesting period of
     * the part of the bounty that is vested in vault's native token.
     * @param _bountyVestingDuration The number of vesting periods
     */
    event CreateVault(
        address indexed _vault,
        address indexed _asset,
        address _committee,
        IRewardController _rewardController,
        uint256 _maxBounty,
        IHATVault.BountySplit _bountySplit,
        string _descriptionHash,
        uint256 _bountyVestingDuration,
        uint256 _bountyVestingPeriods
    );
    
    /** @notice Emitted when a swap of vault tokens to HAT tokens is done and
     * the HATS tokens are sent to beneficiary through vesting contract
     * @param _beneficiary Address of beneficiary
     * @param _amountSwapped Amount of vault's native tokens that was swapped
     * @param _amountSent Amount of HAT tokens sent to beneficiary
     * @param _tokenLock Address of the token lock contract that holds the HAT
     * tokens (address(0) if no token lock is used)
     */
    event SwapAndSend(
        address indexed _beneficiary,
        uint256 _amountSwapped,
        uint256 _amountSent,
        address indexed _tokenLock
    );

    /**
     * @notice Emitted when a new default HAT bounty split is set
     * @param _defaultHATBountySplit The new default HAT bounty split
     */
    event SetDefaultHATBountySplit(HATBountySplit _defaultHATBountySplit);

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
     * @notice Called by governance to pause/unpause the system in case of an
     * emergency
     * @param _isEmergencyPaused Is the system in an emergency pause
     */
    function setEmergencyPaused(bool _isEmergencyPaused) external;

    /**
     * @notice Emit an event that includes the given _descriptionHash
     * This can be used by the claimer as evidence that she had access to the
     * information at the time of the call
     * if a {generalParameters.claimFee} > 0, the caller must send that amount
     * of ETH for the claim to succeed
     * @param _descriptionHash - a hash of an IPFS encrypted file which 
     * describes the claim.
     */
    function logClaim(string memory _descriptionHash) external payable;

    /**
     * @notice Called by governance to set the default HAT token bounty split
     * upon an approval. This default value is used when creating a new vault.
     * @param _defaultHATBountySplit The HAT bounty split
     */
    function setDefaultHATBountySplit(
        HATBountySplit memory _defaultHATBountySplit
    ) 
        external;

    /** 
     * @dev Check that a given hats bounty split is legal, meaning that:
     *   Each entry is a number between 0 and less than `HUNDRED_PERCENT`.
     *   Total splits should be less than `HUNDRED_PERCENT`.
     * function will revert in case the bounty split is not legal.
     * @param _hatBountySplit The bounty split to check
     */
    function validateHATSplit(HATBountySplit memory _hatBountySplit)
         external
         pure;

    /**
     * @notice Called by governance to set the default arbitrator.
     * @param _defaultArbitrator The default arbitrator address
     */
    function setDefaultArbitrator(address _defaultArbitrator) external;

    /**
     * @notice Called by governance to set the default challenge period
     * @param _defaultChallengePeriod The default challenge period
     */
    function setDefaultChallengePeriod(uint256 _defaultChallengePeriod) 
        external;

    /**
     * @notice Called by governance to set the default challenge timeout
     * @param _defaultChallengeTimeOutPeriod The Default challenge timeout
     */
    function setDefaultChallengeTimeOutPeriod(
        uint256 _defaultChallengeTimeOutPeriod
    ) 
        external;

    /**
     * @notice Check that the given challenge period is legal, meaning that it
     * is greater than 1 day and less than 5 days.
     * @param _challengePeriod The challenge period to check
     */
    function validateChallengePeriod(uint256 _challengePeriod) external pure;

    /**
     * @notice Check that the given challenge timeout period is legal, meaning
     * that it is greater than 2 days and less than 85 days.
     * @param _challengeTimeOutPeriod The challenge timeout period to check
     */
    function validateChallengeTimeOutPeriod(uint256 _challengeTimeOutPeriod) external pure;
   
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
        uint256 _withdrawRequestPendingPeriod,
        uint256  _withdrawRequestEnablePeriod
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
        uint256 _withdrawPeriod,
        uint256 _safetyPeriod
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
    function setHatVestingParams(uint256 _duration, uint256 _periods) external;

    /**
     * @notice Called by governance to set the timelock delay for setting the
     * max bounty (the time between setPendingMaxBounty and setMaxBounty)
     * @param _delay The time period for the delay. Must be at least 2 days.
     */
    function setMaxBountyDelay(uint256 _delay) external;

    /**
     * @notice Create a new vault
     * NOTE: Vaults should not use tokens which do not guarantee that the 
     * amount specified is the amount transferred
     * @param _asset The vault's native token
     * @param _committee The address of the vault's committee 
     * @param _rewardController The reward controller for the vault
     * @param _maxBounty The maximum percentage of the vault that can be paid
     * out as a bounty. Must be between 0 and `HUNDRED_PERCENT`
     * @param _bountySplit The way to split the bounty between the hacker, 
     * hacker vested, and committee.
     *   Each entry is a number between 0 and `HUNDRED_PERCENT`.
     *   Total splits should be equal to `HUNDRED_PERCENT`.
     * @param _descriptionHash Hash of the vault description.
     * @param _bountyVestingParams Vesting params for the part of the bounty
     * that is paid vested in the vault's native token:
     *        _bountyVestingParams[0] - vesting duration
     *        _bountyVestingParams[1] - vesting periods
     * @param _isPaused Whether to initialize the vault with deposits disabled
     * @return vault The address of the new vault
     */
    function createVault(
        IERC20 _asset,
        address _owner,
        address _committee,
        IRewardController _rewardController,
        uint256 _maxBounty,
        IHATVault.BountySplit memory _bountySplit,
        string memory _descriptionHash,
        uint256[2] memory _bountyVestingParams,
        bool _isPaused
    ) 
    external 
    returns(address vault);

    /**
     * @notice Called by governance to change the UI visibility of a vault
     * @param _vault The address of the vault to update
     * @param _visible Is this vault visible in the UI
     * This parameter can be used by the UI to include or exclude the vault
     */
    function setVaultVisibility(address _vault, bool _visible) external;

    /**
     * @notice Transfer the part of the bounty that is supposed to be swapped
     * into HAT tokens from the HATVault to the registry, and keep track of
     * the amounts to be swapped and sent/burnt in a later transaction
     * @param _asset The vault's native token
     * @param _hacker The address of the beneficiary of the bounty
     * @param _hackersHatReward The amount of the vault's native token to be
     * swapped to HAT tokens and sent to the hacker via a vesting contract
     * @param _governanceHatReward The amount of the vault's native token to
     * be swapped to HAT tokens and sent to governance
     */
    function addTokensToSwap(
        IERC20 _asset,
        address _hacker,
        uint256 _hackersHatReward,
        uint256 _governanceHatReward
    ) external;

    /**
     * @notice Called by governance to swap the given asset to HAT tokens and 
     * distribute the HAT tokens: Send to governance their share and send to
     * beneficiaries their share through a vesting contract.
     * @param _asset The address of the token to be swapped to HAT tokens
     * @param _beneficiaries Addresses of beneficiaries
     * @param _amountOutMinimum Minimum amount of HAT tokens at swap
     * @param _routingContract Routing contract to call for the swap
     * @param _routingPayload Payload to send to the _routingContract for the
     * swap
     */
    function swapAndSend(
        address _asset,
        address[] calldata _beneficiaries,
        uint256 _amountOutMinimum,
        address _routingContract,
        bytes calldata _routingPayload
    ) external;
  
    /**
     * @notice Returns the general parameters for all vaults
     * @return {GeneralParameters} General parameters for all vaults
     */    
    function getGeneralParameters()
        external 
        view 
        returns(GeneralParameters memory);

    /**
     * @notice Returns the number of vaults that have been previously created
     * @return The number of vaults in the registry
     */
    function getNumberOfVaults() external view returns(uint256);

}
