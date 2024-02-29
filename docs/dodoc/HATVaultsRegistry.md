# HATVaultsRegistry

*Hats.finance*

> Registry to deploy Hats.finance vaults and manage shared parameters

Hats.finance is a proactive bounty protocol for white hat hackers and security experts, where projects, community members, and stakeholders incentivize protocol security and responsible disclosure. Hats create scalable vaults using the project’s own token. The value of the bounty increases with the success of the token and project. The owner of the registry has the permission to set time limits and bounty parameters and change vaults&#39; info, and to set the other registry roles - fee setter and arbitrator. The arbitrator can challenge submitted claims for bounty payouts made by vaults&#39; committees, approve them with a different bounty percentage or dismiss them. The fee setter can set the fee on withdrawals on all vaults. This project is open-source and can be found at: https://github.com/hats-finance/hats-contracts

*New hats.finance vaults should be created through a call to {createVault} so that they are linked to the registry*

## Methods

### HUNDRED_PERCENT

```solidity
function HUNDRED_PERCENT() external view returns (uint16)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint16 | undefined |

### MAX_GOVERNANCE_FEE

```solidity
function MAX_GOVERNANCE_FEE() external view returns (uint16)
```

Get the max governance fee




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint16 | The max governance fee |

### createVault

```solidity
function createVault(IHATVault.VaultInitParams _vaultParams, IHATClaimsManager.ClaimsManagerInitParams _claimsManagerParams) external nonpayable returns (address vault, address vaultClaimsManager)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vaultParams | IHATVault.VaultInitParams | undefined |
| _claimsManagerParams | IHATClaimsManager.ClaimsManagerInitParams | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| vault | address | undefined |
| vaultClaimsManager | address | undefined |

### defaultArbitrator

```solidity
function defaultArbitrator() external view returns (address)
```

Get the default arbitrator address




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | The default arbitrator address |

### defaultChallengePeriod

```solidity
function defaultChallengePeriod() external view returns (uint32)
```

Get the default challenge period




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint32 | The default challenge period |

### defaultChallengeTimeOutPeriod

```solidity
function defaultChallengeTimeOutPeriod() external view returns (uint32)
```

Get the default challenge time out period




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint32 | The default challenge time out period |

### defaultGovernanceFee

```solidity
function defaultGovernanceFee() external view returns (uint16)
```

Get the default fee percentage of the total bounty




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint16 | The default fee percentage of the total bounty |

### feeSetter

```solidity
function feeSetter() external view returns (address)
```

Get the fee setter address




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | The address of the fee setter |

### generalParameters

```solidity
function generalParameters() external view returns (uint32 hatVestingDuration, uint32 hatVestingPeriods, uint32 withdrawPeriod, uint32 safetyPeriod, uint32 withdrawRequestEnablePeriod, uint32 withdrawRequestPendingPeriod, uint32 setMaxBountyDelay, uint256 claimFee)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| hatVestingDuration | uint32 | undefined |
| hatVestingPeriods | uint32 | undefined |
| withdrawPeriod | uint32 | undefined |
| safetyPeriod | uint32 | undefined |
| withdrawRequestEnablePeriod | uint32 | undefined |
| withdrawRequestPendingPeriod | uint32 | undefined |
| setMaxBountyDelay | uint32 | undefined |
| claimFee | uint256 | undefined |

### getNumberOfVaults

```solidity
function getNumberOfVaults() external view returns (uint256)
```

See {IHATVaultsRegistry-getNumberOfVaults}. 




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### getSafetyPeriod

```solidity
function getSafetyPeriod() external view returns (uint256)
```

See {IHATVaultsRegistry-getSafetyPeriod}. 




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### getSetMaxBountyDelay

```solidity
function getSetMaxBountyDelay() external view returns (uint256)
```

See {IHATVaultsRegistry-getSetMaxBountyDelay}. 




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### getWithdrawPeriod

```solidity
function getWithdrawPeriod() external view returns (uint256)
```

See {IHATVaultsRegistry-getWithdrawPeriod}. 




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### getWithdrawRequestEnablePeriod

```solidity
function getWithdrawRequestEnablePeriod() external view returns (uint256)
```

See {IHATVaultsRegistry-getWithdrawRequestEnablePeriod}. 




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### getWithdrawRequestPendingPeriod

```solidity
function getWithdrawRequestPendingPeriod() external view returns (uint256)
```

See {IHATVaultsRegistry-getWithdrawRequestPendingPeriod}. 




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### governanceFeeReceiver

```solidity
function governanceFeeReceiver() external view returns (address)
```

Get the fee receiver address




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | The address of the fee receiver |

### hatClaimsManagerImplementation

```solidity
function hatClaimsManagerImplementation() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### hatVaultImplementation

```solidity
function hatVaultImplementation() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### hatVaults

```solidity
function hatVaults(uint256) external view returns (address)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### isEmergencyPaused

```solidity
function isEmergencyPaused() external view returns (bool)
```

Get whether the system is in an emergency pause




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | Whether the system is in an emergency pause |

### isVaultVisible

```solidity
function isVaultVisible(address) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### logClaim

```solidity
function logClaim(string _descriptionHash) external payable
```

See {IHATVaultsRegistry-logClaim}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _descriptionHash | string | undefined |

### owner

```solidity
function owner() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### renounceOwnership

```solidity
function renounceOwnership() external nonpayable
```



*Leaves the contract without owner. It will not be possible to call `onlyOwner` functions anymore. Can only be called by the current owner. NOTE: Renouncing ownership will leave the contract without an owner, thereby removing any functionality that is only available to the owner.*


### setClaimFee

```solidity
function setClaimFee(uint256 _fee) external nonpayable
```

See {IHATVaultsRegistry-setClaimFee}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _fee | uint256 | undefined |

### setDefaultArbitrator

```solidity
function setDefaultArbitrator(address _defaultArbitrator) external nonpayable
```

See {IHATVaultsRegistry-setDefaultArbitrator}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _defaultArbitrator | address | undefined |

### setDefaultChallengePeriod

```solidity
function setDefaultChallengePeriod(uint32 _defaultChallengePeriod) external nonpayable
```

See {IHATVaultsRegistry-setDefaultChallengePeriod}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _defaultChallengePeriod | uint32 | undefined |

### setDefaultChallengeTimeOutPeriod

```solidity
function setDefaultChallengeTimeOutPeriod(uint32 _defaultChallengeTimeOutPeriod) external nonpayable
```

See {IHATVaultsRegistry-setDefaultChallengeTimeOutPeriod}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _defaultChallengeTimeOutPeriod | uint32 | undefined |

### setDefaultGovernanceFee

```solidity
function setDefaultGovernanceFee(uint16 _defaultGovernanceFee) external nonpayable
```

See {IHATVaultsRegistry-setDefaultGovernanceFee}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _defaultGovernanceFee | uint16 | undefined |

### setEmergencyPaused

```solidity
function setEmergencyPaused(bool _isEmergencyPaused) external nonpayable
```

See {IHATVaultsRegistry-setEmergencyPaused}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _isEmergencyPaused | bool | undefined |

### setFeeSetter

```solidity
function setFeeSetter(address _feeSetter) external nonpayable
```

See {IHATVaultsRegistry-setFeeSetter}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _feeSetter | address | undefined |

### setGovernanceFeeReceiver

```solidity
function setGovernanceFeeReceiver(address _governanceFeeReceiver) external nonpayable
```

See {IHATVaultsRegistry-setGovernanceFeeReceiver}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _governanceFeeReceiver | address | undefined |

### setHatVestingParams

```solidity
function setHatVestingParams(uint32 _duration, uint32 _periods) external nonpayable
```

See {IHATVaultsRegistry-setHatVestingParams}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _duration | uint32 | undefined |
| _periods | uint32 | undefined |

### setMaxBountyDelay

```solidity
function setMaxBountyDelay(uint32 _delay) external nonpayable
```

See {IHATVaultsRegistry-setMaxBountyDelay}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _delay | uint32 | undefined |

### setVaultImplementations

```solidity
function setVaultImplementations(address _hatVaultImplementation, address _hatClaimsManagerImplementation) external nonpayable
```

See {IHATVaultsRegistry-setVaultImplementations}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _hatVaultImplementation | address | undefined |
| _hatClaimsManagerImplementation | address | undefined |

### setVaultVisibility

```solidity
function setVaultVisibility(address _vault, bool _visible) external nonpayable
```

See {IHATVaultsRegistry-setVaultVisibility}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | address | undefined |
| _visible | bool | undefined |

### setWithdrawRequestParams

```solidity
function setWithdrawRequestParams(uint32 _withdrawRequestPendingPeriod, uint32 _withdrawRequestEnablePeriod) external nonpayable
```

See {IHATVaultsRegistry-setWithdrawRequestParams}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _withdrawRequestPendingPeriod | uint32 | undefined |
| _withdrawRequestEnablePeriod | uint32 | undefined |

### setWithdrawSafetyPeriod

```solidity
function setWithdrawSafetyPeriod(uint32 _withdrawPeriod, uint32 _safetyPeriod) external nonpayable
```

See {IHATVaultsRegistry-setWithdrawSafetyPeriod}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _withdrawPeriod | uint32 | undefined |
| _safetyPeriod | uint32 | undefined |

### tokenLockFactory

```solidity
function tokenLockFactory() external view returns (contract ITokenLockFactory)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract ITokenLockFactory | undefined |

### transferOwnership

```solidity
function transferOwnership(address newOwner) external nonpayable
```



*Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| newOwner | address | undefined |

### validateChallengePeriod

```solidity
function validateChallengePeriod(uint32 _challengePeriod) external pure
```

See {IHATVaultsRegistry-validateChallengePeriod}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _challengePeriod | uint32 | undefined |

### validateChallengeTimeOutPeriod

```solidity
function validateChallengeTimeOutPeriod(uint32 _challengeTimeOutPeriod) external pure
```

See {IHATVaultsRegistry-validateChallengeTimeOutPeriod}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _challengeTimeOutPeriod | uint32 | undefined |



## Events

### LogClaim

```solidity
event LogClaim(address indexed _claimer, string _descriptionHash)
```

Emitted when a claim is logged



#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimer `indexed` | address | undefined |
| _descriptionHash  | string | undefined |

### OwnershipTransferred

```solidity
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| previousOwner `indexed` | address | undefined |
| newOwner `indexed` | address | undefined |

### RegistryCreated

```solidity
event RegistryCreated(address _hatVaultImplementation, address _hatClaimsManagerImplementation, address _tokenLockFactory, IHATVaultsRegistry.GeneralParameters _generalParameters, uint16 _defaultGovernanceFee, address _governanceFeeReceiver, address _hatGovernance, address _defaultArbitrator, uint256 _defaultChallengePeriod, uint256 _defaultChallengeTimeOutPeriod)
```

Emitted on deployment of the registry



#### Parameters

| Name | Type | Description |
|---|---|---|
| _hatVaultImplementation  | address | undefined |
| _hatClaimsManagerImplementation  | address | undefined |
| _tokenLockFactory  | address | undefined |
| _generalParameters  | IHATVaultsRegistry.GeneralParameters | undefined |
| _defaultGovernanceFee  | uint16 | undefined |
| _governanceFeeReceiver  | address | undefined |
| _hatGovernance  | address | undefined |
| _defaultArbitrator  | address | undefined |
| _defaultChallengePeriod  | uint256 | undefined |
| _defaultChallengeTimeOutPeriod  | uint256 | undefined |

### SetClaimFee

```solidity
event SetClaimFee(uint256 _fee)
```

Emitted when a new fee for logging a claim for a bounty is set



#### Parameters

| Name | Type | Description |
|---|---|---|
| _fee  | uint256 | undefined |

### SetDefaultArbitrator

```solidity
event SetDefaultArbitrator(address indexed _defaultArbitrator)
```

Emitted when a new default arbitrator is set



#### Parameters

| Name | Type | Description |
|---|---|---|
| _defaultArbitrator `indexed` | address | undefined |

### SetDefaultChallengePeriod

```solidity
event SetDefaultChallengePeriod(uint256 _defaultChallengePeriod)
```

Emitted when a new default challenge period is set



#### Parameters

| Name | Type | Description |
|---|---|---|
| _defaultChallengePeriod  | uint256 | undefined |

### SetDefaultChallengeTimeOutPeriod

```solidity
event SetDefaultChallengeTimeOutPeriod(uint256 _defaultChallengeTimeOutPeriod)
```

Emitted when a new default challenge timeout period is set



#### Parameters

| Name | Type | Description |
|---|---|---|
| _defaultChallengeTimeOutPeriod  | uint256 | undefined |

### SetDefaultGovernanceFee

```solidity
event SetDefaultGovernanceFee(uint16 _defaultGovernanceFee)
```

Emitted when a new default governance fee is set



#### Parameters

| Name | Type | Description |
|---|---|---|
| _defaultGovernanceFee  | uint16 | undefined |

### SetEmergencyPaused

```solidity
event SetEmergencyPaused(bool _isEmergencyPaused)
```

Emitted when the system is put into emergency pause/unpause



#### Parameters

| Name | Type | Description |
|---|---|---|
| _isEmergencyPaused  | bool | undefined |

### SetFeeSetter

```solidity
event SetFeeSetter(address indexed _feeSetter)
```

Emitted when a new fee setter is set



#### Parameters

| Name | Type | Description |
|---|---|---|
| _feeSetter `indexed` | address | undefined |

### SetGovernanceFeeReceiver

```solidity
event SetGovernanceFeeReceiver(address indexed _governaceFeeReceiver)
```

Emitted when a new fee receiver address is set



#### Parameters

| Name | Type | Description |
|---|---|---|
| _governaceFeeReceiver `indexed` | address | undefined |

### SetHATClaimsManagerImplementation

```solidity
event SetHATClaimsManagerImplementation(address indexed _hatClaimsManagerImplementation)
```

Emitted when a new HATClaimsManager implementation is set



#### Parameters

| Name | Type | Description |
|---|---|---|
| _hatClaimsManagerImplementation `indexed` | address | undefined |

### SetHATVaultImplementation

```solidity
event SetHATVaultImplementation(address indexed _hatVaultImplementation)
```

Emitted when a new HATVault implementation is set



#### Parameters

| Name | Type | Description |
|---|---|---|
| _hatVaultImplementation `indexed` | address | undefined |

### SetHatVestingParams

```solidity
event SetHatVestingParams(uint256 _duration, uint256 _periods)
```

Emitted when new HAT vesting parameters are set



#### Parameters

| Name | Type | Description |
|---|---|---|
| _duration  | uint256 | undefined |
| _periods  | uint256 | undefined |

### SetMaxBountyDelay

```solidity
event SetMaxBountyDelay(uint256 _delay)
```

Emitted when a new timelock delay for setting the max bounty is set



#### Parameters

| Name | Type | Description |
|---|---|---|
| _delay  | uint256 | undefined |

### SetVaultVisibility

```solidity
event SetVaultVisibility(address indexed _vault, bool indexed _visible)
```

Emitted when the UI visibility of a vault is changed



#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault `indexed` | address | undefined |
| _visible `indexed` | bool | undefined |

### SetWithdrawRequestParams

```solidity
event SetWithdrawRequestParams(uint256 _withdrawRequestPendingPeriod, uint256 _withdrawRequestEnablePeriod)
```

Emitted when new withdraw request time limits are set



#### Parameters

| Name | Type | Description |
|---|---|---|
| _withdrawRequestPendingPeriod  | uint256 | undefined |
| _withdrawRequestEnablePeriod  | uint256 | undefined |

### SetWithdrawSafetyPeriod

```solidity
event SetWithdrawSafetyPeriod(uint256 _withdrawPeriod, uint256 _safetyPeriod)
```

Emitted when new durations are set for withdraw period and safety period



#### Parameters

| Name | Type | Description |
|---|---|---|
| _withdrawPeriod  | uint256 | undefined |
| _safetyPeriod  | uint256 | undefined |

### VaultCreated

```solidity
event VaultCreated(address indexed _vault, address indexed _claimsManager, IHATVault.VaultInitParams _vaultParams, IHATClaimsManager.ClaimsManagerInitParams _claimsManagerParams)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault `indexed` | address | undefined |
| _claimsManager `indexed` | address | undefined |
| _vaultParams  | IHATVault.VaultInitParams | undefined |
| _claimsManagerParams  | IHATClaimsManager.ClaimsManagerInitParams | undefined |



## Errors

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

Raised on {setDefaultChallengeTimeOutPeriod} if the challenge timeout period to be set is longer than 125 days




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




### FeeCannotBeMoreThanMaxFee

```solidity
error FeeCannotBeMoreThanMaxFee()
```

Raised on {setDefaultGovernanceFee} if the fee to be set is greater than 35% (defined as 3500)




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





