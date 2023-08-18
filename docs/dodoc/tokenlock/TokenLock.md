# TokenLock



> TokenLock

Contract that manages an unlocking schedule of tokens. The contract lock holds a certain amount of tokens deposited  and insures that they can only be released under certain time conditions. This contract implements a release scheduled based on periods and tokens are released in steps after each period ends. It can be configured with one period in which case it is like a plain TimeLock. The contract also supports revocation to be used for vesting schedules. In case that the contract is configured to be  revocable, the owner can revoke the contract at any time and the unvested tokens will be sent back to the owner, even if the  the beneficiary has accepted the lock. The contract supports receiving extra funds than the managed tokens ones that can be withdrawn by the beneficiary at any time. A releaseStartTime parameter is included to override the default release schedule and perform the first release on the configured time. After that it will continue with the default schedule.



## Methods

### acceptLock

```solidity
function acceptLock() external nonpayable
```

Beneficiary accepts the lock, the owner cannot cancel the lock. But in case that the contract is defined as revocable, the owner can revoke the contract at any time and retrieve all unvested tokens.

*Can only be called by the beneficiary*


### amountPerPeriod

```solidity
function amountPerPeriod() external view returns (uint256)
```

Returns amount available to be released after each period according to schedule




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | Amount of tokens available after each period |

### availableAmount

```solidity
function availableAmount() external view returns (uint256)
```

Gets the currently available token according to the schedule

*Implements the step-by-step schedule based on periods for available tokens*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | Amount of tokens available according to the schedule |

### beneficiary

```solidity
function beneficiary() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### cancelLock

```solidity
function cancelLock() external nonpayable
```

Owner cancel the lock and return the balance in the contract

*Can only be called by the owner*


### changeBeneficiary

```solidity
function changeBeneficiary(address _newBeneficiary) external nonpayable
```

Change the beneficiary of funds managed by the contract

*Can only be called by the beneficiary*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _newBeneficiary | address | Address of the new beneficiary address |

### currentBalance

```solidity
function currentBalance() external view returns (uint256)
```

Returns the amount of tokens currently held by the contract




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | Tokens held in the contract |

### currentPeriod

```solidity
function currentPeriod() external view returns (uint256)
```

Gets the current period based on the schedule




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | A number that represents the current period |

### currentTime

```solidity
function currentTime() external view returns (uint256)
```

Returns the current block timestamp




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | Current block timestamp |

### duration

```solidity
function duration() external view returns (uint256)
```

Gets duration of contract from start to end in seconds




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | Amount of seconds from contract startTime to endTime |

### endTime

```solidity
function endTime() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### isAccepted

```solidity
function isAccepted() external view returns (bool)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### isInitialized

```solidity
function isInitialized() external view returns (bool)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### isRevoked

```solidity
function isRevoked() external view returns (bool)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### managedAmount

```solidity
function managedAmount() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### owner

```solidity
function owner() external view returns (address)
```



*Returns the address of the current owner.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### passedPeriods

```solidity
function passedPeriods() external view returns (uint256)
```

Gets the number of periods that passed since the first period




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | A number of periods that passed since the schedule started |

### periodDuration

```solidity
function periodDuration() external view returns (uint256)
```

Returns the duration of each period in seconds




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | Duration of each period in seconds |

### periods

```solidity
function periods() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### releasableAmount

```solidity
function releasableAmount() external view returns (uint256)
```

Gets tokens currently available for release

*Considers the schedule and takes into account already released tokens*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | Amount of tokens ready to be released |

### release

```solidity
function release() external nonpayable
```

Releases tokens based on the configured schedule

*All available releasable tokens are transferred to beneficiary*


### releaseStartTime

```solidity
function releaseStartTime() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### releasedAmount

```solidity
function releasedAmount() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### renounceOwnership

```solidity
function renounceOwnership() external nonpayable
```



*Leaves the contract without owner. It will not be possible to call `onlyOwner` functions. Can only be called by the current owner. NOTE: Renouncing ownership will leave the contract without an owner, thereby disabling any functionality that is only available to the owner.*


### revocable

```solidity
function revocable() external view returns (bool)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### revoke

```solidity
function revoke() external nonpayable
```

Revokes a vesting schedule and return the unvested tokens to the owner

*Vesting schedule is always calculated based on managed tokens*


### sinceStartTime

```solidity
function sinceStartTime() external view returns (uint256)
```

Gets time elapsed since the start of the contract

*Returns zero if called before conctract starTime*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | Seconds elapsed from contract startTime |

### startTime

```solidity
function startTime() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### surplusAmount

```solidity
function surplusAmount() external view returns (uint256)
```

Gets surplus amount in the contract based on outstanding amount to release

*All funds over outstanding amount is considered surplus that can be withdrawn by beneficiary*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | Amount of tokens considered as surplus |

### sweepToken

```solidity
function sweepToken(contract IERC20 _token) external nonpayable
```

Sweeps out accidentally sent tokens



#### Parameters

| Name | Type | Description |
|---|---|---|
| _token | contract IERC20 | Address of token to sweep |

### token

```solidity
function token() external view returns (contract IERC20)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IERC20 | undefined |

### totalOutstandingAmount

```solidity
function totalOutstandingAmount() external view returns (uint256)
```

Gets the outstanding amount yet to be released based on the whole contract lifetime

*Does not consider schedule but just global amounts tracked*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | Amount of outstanding tokens for the lifetime of the contract |

### transferOwnership

```solidity
function transferOwnership(address newOwner) external nonpayable
```



*Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| newOwner | address | undefined |

### vestedAmount

```solidity
function vestedAmount() external view returns (uint256)
```

Gets the amount of currently vested tokens

*Similar to available amount, but is fully vested when contract is non-revocable*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | Amount of tokens already vested |

### vestingCliffTime

```solidity
function vestingCliffTime() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### withdrawSurplus

```solidity
function withdrawSurplus(uint256 _amount) external nonpayable
```

Withdraws surplus, unmanaged tokens from the contract

*Tokens in the contract over outstanding amount are considered as surplus*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _amount | uint256 | Amount of tokens to withdraw |



## Events

### BeneficiaryChanged

```solidity
event BeneficiaryChanged(address newBeneficiary)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| newBeneficiary  | address | undefined |

### LockAccepted

```solidity
event LockAccepted()
```






### LockCanceled

```solidity
event LockCanceled()
```






### OwnershipTransferred

```solidity
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| previousOwner `indexed` | address | undefined |
| newOwner `indexed` | address | undefined |

### TokensReleased

```solidity
event TokensReleased(address indexed beneficiary, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| beneficiary `indexed` | address | undefined |
| amount  | uint256 | undefined |

### TokensRevoked

```solidity
event TokensRevoked(address indexed beneficiary, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| beneficiary `indexed` | address | undefined |
| amount  | uint256 | undefined |

### TokensWithdrawn

```solidity
event TokensWithdrawn(address indexed beneficiary, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| beneficiary `indexed` | address | undefined |
| amount  | uint256 | undefined |



## Errors

### AlreadyInitialized

```solidity
error AlreadyInitialized()
```






### AmountCannotBeZero

```solidity
error AmountCannotBeZero()
```






### AmountRequestedBiggerThanSurplus

```solidity
error AmountRequestedBiggerThanSurplus()
```






### BeneficiaryCannotBeZero

```solidity
error BeneficiaryCannotBeZero()
```






### CannotCancelAfterLockIsAccepted

```solidity
error CannotCancelAfterLockIsAccepted()
```






### CannotSweepVestedToken

```solidity
error CannotSweepVestedToken()
```






### CliffTimeMustBeBeforeEndTime

```solidity
error CliffTimeMustBeBeforeEndTime()
```






### LockIsNonRevocable

```solidity
error LockIsNonRevocable()
```






### ManagedAmountCannotBeZero

```solidity
error ManagedAmountCannotBeZero()
```






### NoAmountAvailableToRelease

```solidity
error NoAmountAvailableToRelease()
```






### NoAvailableUnvestedAmount

```solidity
error NoAvailableUnvestedAmount()
```






### OnlyBeneficiary

```solidity
error OnlyBeneficiary()
```






### OnlySweeper

```solidity
error OnlySweeper()
```






### PeriodsCannotBeBelowMinimum

```solidity
error PeriodsCannotBeBelowMinimum()
```






### ReleaseStartTimeMustBeBeforeEndTime

```solidity
error ReleaseStartTimeMustBeBeforeEndTime()
```






### StartTimeCannotBeZero

```solidity
error StartTimeCannotBeZero()
```






### StartTimeMustBeBeforeEndTime

```solidity
error StartTimeMustBeBeforeEndTime()
```






### TokenCannotBeZero

```solidity
error TokenCannotBeZero()
```







