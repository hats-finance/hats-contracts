# IHATVaultsRegistry

*hats.finance*

> Interface for the Hats.finance Vault Registry

The Hats.finance Vault Registry is used to deploy Hats.finance vaults and manage shared parameters. Hats.finance is a proactive bounty protocol for white hat hackers and security experts, where projects, community members, and stakeholders incentivize protocol security and responsible disclosure. Hats create scalable vaults using the project’s own token. The value of the bounty increases with the success of the token and project. The owner of the registry has the permission to set time limits and bounty parameters and change vaults&#39; info, and to set the other registry roles - fee setter and arbitrator. The arbitrator can challenge submitted claims for bounty payouts made by vaults&#39; committees, approve them with a different bounty percentage or dismiss them. The fee setter can set the fee on withdrawals on all vaults. This project is open-source and can be found at: https://github.com/hats-finance/hats-contracts

*New hats.finance vaults should be created through a call to {createVault} so that they are linked to the registry*

## Methods

### addTokensToSwap

```solidity
function addTokensToSwap(contract IERC20 _asset, address _hacker, uint256 _hackersHatReward, uint256 _governanceHatReward) external nonpayable
```

Transfer the part of the bounty that is supposed to be swapped into HAT tokens from the HATVault to the registry, and keep track of the amounts to be swapped and sent/burnt in a later transaction



#### Parameters

| Name | Type | Description |
|---|---|---|
| _asset | contract IERC20 | The vault&#39;s native token |
| _hacker | address | The address of the beneficiary of the bounty |
| _hackersHatReward | uint256 | The amount of the vault&#39;s native token to be swapped to HAT tokens and sent to the hacker via a vesting contract |
| _governanceHatReward | uint256 | The amount of the vault&#39;s native token to be swapped to HAT tokens and sent to governance |

### createVault

```solidity
function createVault(IHATVault.VaultInitParams _params) external nonpayable returns (address vault)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _params | IHATVault.VaultInitParams | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| vault | address | undefined |

### getNumberOfVaults

```solidity
function getNumberOfVaults() external view returns (uint256)
```

Returns the number of vaults that have been previously created




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | The number of vaults in the registry |

### getSafetyPeriod

```solidity
function getSafetyPeriod() external view returns (uint256)
```

Returns the withdraw disable period - time for the committee to gather and decide on actions, withdrawals are not possible in this time. The withdraw period starts when finished.




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | Safety period for all vaults |

### getSetMaxBountyDelay

```solidity
function getSetMaxBountyDelay() external view returns (uint256)
```

Returns the set max bounty delay for all vaults - period of time that has to pass after setting a pending max bounty before it can be set as the new max bounty




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | Set max bounty delay for all vaults |

### getWithdrawPeriod

```solidity
function getWithdrawPeriod() external view returns (uint256)
```

Returns the withdraw enable period for all vaults. The safety period starts when finished.




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | Withdraw enable period for all vaults |

### getWithdrawRequestEnablePeriod

```solidity
function getWithdrawRequestEnablePeriod() external view returns (uint256)
```

Returns the withdraw request enable period for all vaults - period of time after withdrawRequestPendingPeriod where it is possible to withdraw, and after which withdrawals are not possible.




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | Withdraw request enable period for all vaults |

### getWithdrawRequestPendingPeriod

```solidity
function getWithdrawRequestPendingPeriod() external view returns (uint256)
```

Returns the withdraw request pending period for all vaults - period of time that has to pass after withdraw request until withdraw is possible




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | Withdraw request pending period for all vaults |

### logClaim

```solidity
function logClaim(string _descriptionHash) external payable
```

Emit an event that includes the given _descriptionHash This can be used by the claimer as evidence that she had access to the information at the time of the call if a {generalParameters.claimFee} &gt; 0, the caller must send that amount of ETH for the claim to succeed



#### Parameters

| Name | Type | Description |
|---|---|---|
| _descriptionHash | string | - a hash of an IPFS encrypted file which  describes the claim. |

### setClaimFee

```solidity
function setClaimFee(uint256 _fee) external nonpayable
```

Called by governance to set the fee for logging a claim for a bounty in any vault.



#### Parameters

| Name | Type | Description |
|---|---|---|
| _fee | uint256 | Claim fee in ETH to be transferred on any call of {logClaim} |

### setDefaultArbitrator

```solidity
function setDefaultArbitrator(address _defaultArbitrator) external nonpayable
```

Called by governance to set the default arbitrator.



#### Parameters

| Name | Type | Description |
|---|---|---|
| _defaultArbitrator | address | The default arbitrator address |

### setDefaultArbitratorCanChangeBounty

```solidity
function setDefaultArbitratorCanChangeBounty(bool _defaultArbitratorCanChangeBounty) external nonpayable
```

Called by governance to set Whether the arbitrator can change bounty of claims.



#### Parameters

| Name | Type | Description |
|---|---|---|
| _defaultArbitratorCanChangeBounty | bool | The default for whether the arbitrator can change bounty of claims |

### setDefaultChallengePeriod

```solidity
function setDefaultChallengePeriod(uint32 _defaultChallengePeriod) external nonpayable
```

Called by governance to set the default challenge period



#### Parameters

| Name | Type | Description |
|---|---|---|
| _defaultChallengePeriod | uint32 | The default challenge period |

### setDefaultChallengeTimeOutPeriod

```solidity
function setDefaultChallengeTimeOutPeriod(uint32 _defaultChallengeTimeOutPeriod) external nonpayable
```

Called by governance to set the default challenge timeout



#### Parameters

| Name | Type | Description |
|---|---|---|
| _defaultChallengeTimeOutPeriod | uint32 | The Default challenge timeout |

### setDefaultHATBountySplit

```solidity
function setDefaultHATBountySplit(uint16 _defaultBountyGovernanceHAT, uint16 _defaultBountyHackerHATVested) external nonpayable
```

Called by governance to set the default percentage of each claim bounty that will be swapped for hats and sent to the governance or vested for the hacker



#### Parameters

| Name | Type | Description |
|---|---|---|
| _defaultBountyGovernanceHAT | uint16 | The HAT bounty for governance |
| _defaultBountyHackerHATVested | uint16 | The HAT bounty vested for the hacker |

### setEmergencyPaused

```solidity
function setEmergencyPaused(bool _isEmergencyPaused) external nonpayable
```

Called by governance to pause/unpause the system in case of an emergency



#### Parameters

| Name | Type | Description |
|---|---|---|
| _isEmergencyPaused | bool | Is the system in an emergency pause |

### setFeeSetter

```solidity
function setFeeSetter(address _feeSetter) external nonpayable
```

Called by governance to set the fee setter role



#### Parameters

| Name | Type | Description |
|---|---|---|
| _feeSetter | address | Address of new fee setter |

### setHatVestingParams

```solidity
function setHatVestingParams(uint32 _duration, uint32 _periods) external nonpayable
```

Called by governance to set vesting params for rewarding hackers with rewardToken, for all vaults



#### Parameters

| Name | Type | Description |
|---|---|---|
| _duration | uint32 | Duration of the vesting period. Must be less than 180 days. |
| _periods | uint32 | The number of vesting periods. Must be more than 0 and  less then the vesting duration. |

### setMaxBountyDelay

```solidity
function setMaxBountyDelay(uint32 _delay) external nonpayable
```

Called by governance to set the timelock delay for setting the max bounty (the time between setPendingMaxBounty and setMaxBounty)



#### Parameters

| Name | Type | Description |
|---|---|---|
| _delay | uint32 | The time period for the delay. Must be at least 2 days. |

### setVaultVisibility

```solidity
function setVaultVisibility(address _vault, bool _visible) external nonpayable
```

Called by governance to change the UI visibility of a vault



#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | address | The address of the vault to update |
| _visible | bool | Is this vault visible in the UI This parameter can be used by the UI to include or exclude the vault |

### setWithdrawRequestParams

```solidity
function setWithdrawRequestParams(uint32 _withdrawRequestPendingPeriod, uint32 _withdrawRequestEnablePeriod) external nonpayable
```

Called by governance to set time limits for withdraw requests



#### Parameters

| Name | Type | Description |
|---|---|---|
| _withdrawRequestPendingPeriod | uint32 | Time period where the withdraw request is pending |
| _withdrawRequestEnablePeriod | uint32 | Time period after the peding period has ended during which withdrawal is enabled |

### setWithdrawSafetyPeriod

```solidity
function setWithdrawSafetyPeriod(uint32 _withdrawPeriod, uint32 _safetyPeriod) external nonpayable
```

Called by governance to set the withdraw period and safety period, which are always interchanging. The safety period is time that the committee can submit claims for  bounty payouts, and during which withdrawals are disabled and the bounty split cannot be changed.



#### Parameters

| Name | Type | Description |
|---|---|---|
| _withdrawPeriod | uint32 | Amount of time during which withdrawals are enabled, and the bounty split can be changed by the governance. Must be at least 1 hour. |
| _safetyPeriod | uint32 | Amount of time during which claims for bounties  can be submitted and withdrawals are disabled. Must be at most 6 hours. |

### swapAndSend

```solidity
function swapAndSend(address _asset, address[] _beneficiaries, uint256 _amountOutMinimum, address _routingContract, bytes _routingPayload) external nonpayable
```

Called by governance to swap the given asset to HAT tokens and  distribute the HAT tokens: Send to governance their share and send to beneficiaries their share through a vesting contract.



#### Parameters

| Name | Type | Description |
|---|---|---|
| _asset | address | The address of the token to be swapped to HAT tokens |
| _beneficiaries | address[] | Addresses of beneficiaries |
| _amountOutMinimum | uint256 | Minimum amount of HAT tokens at swap |
| _routingContract | address | Routing contract to call for the swap |
| _routingPayload | bytes | Payload to send to the _routingContract for the swap |

### validateChallengePeriod

```solidity
function validateChallengePeriod(uint32 _challengePeriod) external pure
```

Check that the given challenge period is legal, meaning that it is greater than 1 day and less than 5 days.



#### Parameters

| Name | Type | Description |
|---|---|---|
| _challengePeriod | uint32 | The challenge period to check |

### validateChallengeTimeOutPeriod

```solidity
function validateChallengeTimeOutPeriod(uint32 _challengeTimeOutPeriod) external pure
```

Check that the given challenge timeout period is legal, meaning that it is greater than 2 days and less than 85 days.



#### Parameters

| Name | Type | Description |
|---|---|---|
| _challengeTimeOutPeriod | uint32 | The challenge timeout period to check |

### validateHATSplit

```solidity
function validateHATSplit(uint16 _bountyGovernanceHAT, uint16 _bountyHackerHATVested) external pure
```



*Check that a given hats bounty split is legal, meaning that:   Each entry is a number between 0 and less than `MAX_HAT_SPLIT`.   Total splits should be less than `MAX_HAT_SPLIT`. function will revert in case the bounty split is not legal.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _bountyGovernanceHAT | uint16 | The HAT bounty for governance |
| _bountyHackerHATVested | uint16 | The HAT bounty vested for the hacker |



## Events

### LogClaim

```solidity
event LogClaim(address indexed _claimer, string _descriptionHash)
```

Emitted when a claim is logged



#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimer `indexed` | address | The address of the claimer |
| _descriptionHash  | string | - a hash of an ipfs encrypted file which describes the claim. |

### RegistryCreated

```solidity
event RegistryCreated(address _hatVaultImplementation, address _HAT, address _tokenLockFactory, IHATVaultsRegistry.GeneralParameters _generalParameters, uint256 _bountyGovernanceHAT, uint256 _bountyHackerHATVested, address _hatGovernance, address _defaultArbitrator, uint256 _defaultChallengePeriod, uint256 _defaultChallengeTimeOutPeriod, bool _defaultArbitratorCanChangeBounty)
```

Emitted on deployment of the registry



#### Parameters

| Name | Type | Description |
|---|---|---|
| _hatVaultImplementation  | address | The HATVault implementation address |
| _HAT  | address | The HAT token address |
| _tokenLockFactory  | address | The token lock factory address |
| _generalParameters  | IHATVaultsRegistry.GeneralParameters | The registry&#39;s general parameters |
| _bountyGovernanceHAT  | uint256 | The HAT bounty for governance |
| _bountyHackerHATVested  | uint256 | The HAT bounty vested for the hacker |
| _hatGovernance  | address | The registry&#39;s governance |
| _defaultArbitrator  | address | undefined |
| _defaultChallengePeriod  | uint256 | The new default challenge period |
| _defaultChallengeTimeOutPeriod  | uint256 | The new default challenge timeout |
| _defaultArbitratorCanChangeBounty  | bool | Whether the arbitrator can change bounty percentage of claims |

### SetClaimFee

```solidity
event SetClaimFee(uint256 _fee)
```

Emitted when a new fee for logging a claim for a bounty is set



#### Parameters

| Name | Type | Description |
|---|---|---|
| _fee  | uint256 | Claim fee in ETH to be transferred on any call of {logClaim} |

### SetDefaultArbitrator

```solidity
event SetDefaultArbitrator(address indexed _defaultArbitrator)
```

Emitted when a new default arbitrator is set



#### Parameters

| Name | Type | Description |
|---|---|---|
| _defaultArbitrator `indexed` | address | The address of the new arbitrator |

### SetDefaultArbitratorCanChangeBounty

```solidity
event SetDefaultArbitratorCanChangeBounty(bool _defaultArbitratorCanChangeBounty)
```

Emitted when the default arbitrator can change bounty is set



#### Parameters

| Name | Type | Description |
|---|---|---|
| _defaultArbitratorCanChangeBounty  | bool | Whether the arbitrator can change bounty of claims |

### SetDefaultChallengePeriod

```solidity
event SetDefaultChallengePeriod(uint256 _defaultChallengePeriod)
```

Emitted when a new default challenge period is set



#### Parameters

| Name | Type | Description |
|---|---|---|
| _defaultChallengePeriod  | uint256 | The new default challenge period |

### SetDefaultChallengeTimeOutPeriod

```solidity
event SetDefaultChallengeTimeOutPeriod(uint256 _defaultChallengeTimeOutPeriod)
```

Emitted when a new default challenge timeout period is set



#### Parameters

| Name | Type | Description |
|---|---|---|
| _defaultChallengeTimeOutPeriod  | uint256 | The new default challenge timeout period |

### SetDefaultHATBountySplit

```solidity
event SetDefaultHATBountySplit(uint256 _defaultBountyGovernanceHAT, uint256 _defaultBountyHackerHATVested)
```

Emitted when a new default HAT bounty split is set



#### Parameters

| Name | Type | Description |
|---|---|---|
| _defaultBountyGovernanceHAT  | uint256 | The new default HAT bounty part sent to governance |
| _defaultBountyHackerHATVested  | uint256 | The new default HAT bounty part vseted for the hacker |

### SetEmergencyPaused

```solidity
event SetEmergencyPaused(bool _isEmergencyPaused)
```

Emitted when the system is put into emergency pause/unpause



#### Parameters

| Name | Type | Description |
|---|---|---|
| _isEmergencyPaused  | bool | Is the system in an emergency pause |

### SetFeeSetter

```solidity
event SetFeeSetter(address indexed _feeSetter)
```

Emitted when a new fee setter is set



#### Parameters

| Name | Type | Description |
|---|---|---|
| _feeSetter `indexed` | address | The address of the new fee setter |

### SetHatVestingParams

```solidity
event SetHatVestingParams(uint256 _duration, uint256 _periods)
```

Emitted when new HAT vesting parameters are set



#### Parameters

| Name | Type | Description |
|---|---|---|
| _duration  | uint256 | The duration of the vesting period |
| _periods  | uint256 | The number of vesting periods |

### SetMaxBountyDelay

```solidity
event SetMaxBountyDelay(uint256 _delay)
```

Emitted when a new timelock delay for setting the max bounty is set



#### Parameters

| Name | Type | Description |
|---|---|---|
| _delay  | uint256 | The time period for the delay |

### SetVaultVisibility

```solidity
event SetVaultVisibility(address indexed _vault, bool indexed _visible)
```

Emitted when the UI visibility of a vault is changed



#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault `indexed` | address | The address of the vault to update |
| _visible `indexed` | bool | Is this vault visible in the UI |

### SetWithdrawRequestParams

```solidity
event SetWithdrawRequestParams(uint256 _withdrawRequestPendingPeriod, uint256 _withdrawRequestEnablePeriod)
```

Emitted when new withdraw request time limits are set



#### Parameters

| Name | Type | Description |
|---|---|---|
| _withdrawRequestPendingPeriod  | uint256 | Time period where the withdraw request is pending |
| _withdrawRequestEnablePeriod  | uint256 | Time period after the peding period has ended during which withdrawal is enabled |

### SetWithdrawSafetyPeriod

```solidity
event SetWithdrawSafetyPeriod(uint256 _withdrawPeriod, uint256 _safetyPeriod)
```

Emitted when new durations are set for withdraw period and safety period



#### Parameters

| Name | Type | Description |
|---|---|---|
| _withdrawPeriod  | uint256 | Amount of time during which withdrawals are enabled, and the bounty split can be changed by the governance |
| _safetyPeriod  | uint256 | Amount of time during which claims for bounties  can be submitted and withdrawals are disabled |

### SwapAndSend

```solidity
event SwapAndSend(address indexed _beneficiary, uint256 _amountSwapped, uint256 _amountSent, address indexed _tokenLock)
```

Emitted when a swap of vault tokens to HAT tokens is done and the HATS tokens are sent to beneficiary through vesting contract



#### Parameters

| Name | Type | Description |
|---|---|---|
| _beneficiary `indexed` | address | Address of beneficiary |
| _amountSwapped  | uint256 | Amount of vault&#39;s native tokens that was swapped |
| _amountSent  | uint256 | Amount of HAT tokens sent to beneficiary |
| _tokenLock `indexed` | address | Address of the token lock contract that holds the HAT tokens (address(0) if no token lock is used) |

### VaultCreated

```solidity
event VaultCreated(address indexed _vault, IHATVault.VaultInitParams _params)
```



*Emitted when a new vault is created*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault `indexed` | address | The address of the vault to add to the registry |
| _params  | IHATVault.VaultInitParams | The vault initialization parameters |



## Errors

### AmountSwappedLessThanMinimum

```solidity
error AmountSwappedLessThanMinimum()
```

Raised on {swapAndSend} if the amount that was recieved in the swap was less than the minimum amount specified




### AmountToSwapIsZero

```solidity
error AmountToSwapIsZero()
```

Raised on {swapAndSend} if the amount to swap is zero




### ChallengePeriodTooLong

```solidity
error ChallengePeriodTooLong()
```

Raised on {setDefaultChallengePeriod} if the challenge period  to be set is longer than 5 days




### ChallengePeriodTooShort

```solidity
error ChallengePeriodTooShort()
```

Raised on {setDefaultChallengePeriod} if the challenge period  to be set is shorter than 1 day




### ChallengeTimeOutPeriodTooLong

```solidity
error ChallengeTimeOutPeriodTooLong()
```

Raised on {setDefaultChallengeTimeOutPeriod} if the challenge timeout period to be set is longer than 85 days




### ChallengeTimeOutPeriodTooShort

```solidity
error ChallengeTimeOutPeriodTooShort()
```

Raised on {setDefaultChallengeTimeOutPeriod} if the challenge timeout period to be set is shorter than 1 day




### ClaimFeeTransferFailed

```solidity
error ClaimFeeTransferFailed()
```

Raised on {LogClaim} if the transfer of the claim fee failed




### DelayTooShort

```solidity
error DelayTooShort()
```

Raised on {setMaxBountyDelay} if the max bounty to be set is shorter than 2 days




### HatVestingDurationSmallerThanPeriods

```solidity
error HatVestingDurationSmallerThanPeriods()
```

Raised on {setHatVestingParams} if the vesting duration is  smaller than the vesting periods




### HatVestingDurationTooLong

```solidity
error HatVestingDurationTooLong()
```

Raised on {setHatVestingParams} if the vesting duration to be set is longer than 180 days




### HatVestingPeriodsCannotBeZero

```solidity
error HatVestingPeriodsCannotBeZero()
```

Raised on {setHatVestingParams} if the vesting periods to be set is 0




### NotEnoughFeePaid

```solidity
error NotEnoughFeePaid()
```

Raised on {LogClaim} if the transaction was not sent with the amount of ETH specified as {generalParameters.claimFee}




### SafetyPeriodTooLong

```solidity
error SafetyPeriodTooLong()
```

Raised on {setWithdrawSafetyPeriod} if the safety period to be set is longer than 6 hours




### SwapFailed

```solidity
error SwapFailed()
```

Raised on {swapAndSend} if the swap was not successful




### TotalHatsSplitPercentageShouldBeUpToMaxHATSplit

```solidity
error TotalHatsSplitPercentageShouldBeUpToMaxHATSplit()
```

Raised on {setDefaultHATBountySplit} if the split to be set is greater than 20% (defined as 2000)




### WithdrawPeriodTooShort

```solidity
error WithdrawPeriodTooShort()
```

Raised on {setWithdrawSafetyPeriod} if the withdraw period to be set is shorter than 1 hour




### WithdrawRequestEnabledPeriodTooLong

```solidity
error WithdrawRequestEnabledPeriodTooLong()
```

Raised on {setWithdrawRequestParams} if the withdraw request enabled period to be set is longer than 100 days




### WithdrawRequestEnabledPeriodTooShort

```solidity
error WithdrawRequestEnabledPeriodTooShort()
```

Raised on {setWithdrawRequestParams} if the withdraw request enabled period to be set is shorter than 6 hours




### WithdrawRequestPendingPeriodTooLong

```solidity
error WithdrawRequestPendingPeriodTooLong()
```

Raised on {setWithdrawRequestParams} if the withdraw request pending period to be set is shorter than 3 months





