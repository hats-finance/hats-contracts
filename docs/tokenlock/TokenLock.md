
Contract that manages an unlocking schedule of tokens.

The contract lock manage a number of tokens deposited into the contract to ensure that
they can only be released under certain time conditions.

This contract implements a release scheduled based on periods and tokens are released in steps
after each period ends. It can be configured with one period in which case it is like a plain TimeLock.
It also supports revocation to be used for vesting schedules.

The contract supports receiving extra funds than the managed tokens ones that can be
withdrawn by the beneficiary at any time.

A releaseStartTime parameter is included to override the default release schedule and
perform the first release on the configured time. After that it will continue with the
default schedule.

## Functions
### _initialize
```solidity
  function _initialize(
    address _tokenLockOwner,
    address _beneficiary,
    address _managedAmount,
    uint256 _startTime,
    uint256 _endTime,
    uint256 _periods,
    uint256 _releaseStartTime,
    uint256 _vestingCliffTime,
    uint256 _revocable
  ) internal
```
Initializes the contract


#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_tokenLockOwner` | address | Address of the contract owner
|`_beneficiary` | address | Address of the beneficiary of locked tokens
|`_managedAmount` | address | Amount of tokens to be managed by the lock contract
|`_startTime` | uint256 | Start time of the release schedule
|`_endTime` | uint256 | End time of the release schedule
|`_periods` | uint256 | Number of periods between start time and end time
|`_releaseStartTime` | uint256 | Override time for when the releases start
|`_vestingCliffTime` | uint256 | Override time for when the vesting start
|`_revocable` | uint256 | Whether the contract is revocable

### changeBeneficiary
```solidity
  function changeBeneficiary(
    address _newBeneficiary
  ) external
```
Change the beneficiary of funds managed by the contract

Can only be called by the beneficiary

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_newBeneficiary` | address | Address of the new beneficiary address

### acceptLock
```solidity
  function acceptLock(
  ) external
```
Beneficiary accepts the lock, the owner cannot retrieve back the tokens

Can only be called by the beneficiary


### cancelLock
```solidity
  function cancelLock(
  ) external
```
Owner cancel the lock and return the balance in the contract

Can only be called by the owner


### currentBalance
```solidity
  function currentBalance(
  ) public returns (uint256)
```
Returns the amount of tokens currently held by the contract



#### Return Values:
| Name                           | Type          | Description                                                                  |
| :----------------------------- | :------------ | :--------------------------------------------------------------------------- |
|`Tokens`|  | held in the contract

### currentTime
```solidity
  function currentTime(
  ) public returns (uint256)
```
Returns the current block timestamp



#### Return Values:
| Name                           | Type          | Description                                                                  |
| :----------------------------- | :------------ | :--------------------------------------------------------------------------- |
|`Current`|  | block timestamp

### duration
```solidity
  function duration(
  ) public returns (uint256)
```
Gets duration of contract from start to end in seconds



#### Return Values:
| Name                           | Type          | Description                                                                  |
| :----------------------------- | :------------ | :--------------------------------------------------------------------------- |
|`Amount`|  | of seconds from contract startTime to endTime

### sinceStartTime
```solidity
  function sinceStartTime(
  ) public returns (uint256)
```
Gets time elapsed since the start of the contract

Returns zero if called before conctract starTime


#### Return Values:
| Name                           | Type          | Description                                                                  |
| :----------------------------- | :------------ | :--------------------------------------------------------------------------- |
|`Seconds`|  | elapsed from contract startTime

### amountPerPeriod
```solidity
  function amountPerPeriod(
  ) public returns (uint256)
```
Returns amount available to be released after each period according to schedule



#### Return Values:
| Name                           | Type          | Description                                                                  |
| :----------------------------- | :------------ | :--------------------------------------------------------------------------- |
|`Amount`|  | of tokens available after each period

### periodDuration
```solidity
  function periodDuration(
  ) public returns (uint256)
```
Returns the duration of each period in seconds



#### Return Values:
| Name                           | Type          | Description                                                                  |
| :----------------------------- | :------------ | :--------------------------------------------------------------------------- |
|`Duration`|  | of each period in seconds
### currentPeriod
```solidity
  function currentPeriod(
  ) public returns (uint256)
```
Gets the current period based on the schedule



#### Return Values:
| Name                           | Type          | Description                                                                  |
| :----------------------------- | :------------ | :--------------------------------------------------------------------------- |
|`A`|  | number that represents the current period

### passedPeriods
```solidity
  function passedPeriods(
  ) public returns (uint256)
```
Gets the number of periods that passed since the first period



#### Return Values:
| Name                           | Type          | Description                                                                  |
| :----------------------------- | :------------ | :--------------------------------------------------------------------------- |
|`A`|  | number of periods that passed since the schedule started

### availableAmount
```solidity
  function availableAmount(
  ) public returns (uint256)
```
Gets the currently available token according to the schedule

Implements the step-by-step schedule based on periods for available tokens


#### Return Values:
| Name                           | Type          | Description                                                                  |
| :----------------------------- | :------------ | :--------------------------------------------------------------------------- |
|`Amount`|  | of tokens available according to the schedule

### vestedAmount
```solidity
  function vestedAmount(
  ) public returns (uint256)
```
Gets the amount of currently vested tokens

Similar to available amount, but is fully vested when contract is non-revocable


#### Return Values:
| Name                           | Type          | Description                                                                  |
| :----------------------------- | :------------ | :--------------------------------------------------------------------------- |
|`Amount`|  | of tokens already vested
### releasableAmount
```solidity
  function releasableAmount(
  ) public returns (uint256)
```
Gets tokens currently available for release

Considers the schedule and takes into account already released tokens


#### Return Values:
| Name                           | Type          | Description                                                                  |
| :----------------------------- | :------------ | :--------------------------------------------------------------------------- |
|`Amount`|  | of tokens ready to be released

### totalOutstandingAmount
```solidity
  function totalOutstandingAmount(
  ) public returns (uint256)
```
Gets the outstanding amount yet to be released based on the whole contract lifetime

Does not consider schedule but just global amounts tracked


#### Return Values:
| Name                           | Type          | Description                                                                  |
| :----------------------------- | :------------ | :--------------------------------------------------------------------------- |
|`Amount`|  | of outstanding tokens for the lifetime of the contract

### surplusAmount
```solidity
  function surplusAmount(
  ) public returns (uint256)
```
Gets surplus amount in the contract based on outstanding amount to release

All funds over outstanding amount is considered surplus that can be withdrawn by beneficiary


#### Return Values:
| Name                           | Type          | Description                                                                  |
| :----------------------------- | :------------ | :--------------------------------------------------------------------------- |
|`Amount`|  | of tokens considered as surplus

### release
```solidity
  function release(
  ) external
```
Releases tokens based on the configured schedule

All available releasable tokens are transferred to beneficiary


### withdrawSurplus
```solidity
  function withdrawSurplus(
    uint256 _amount
  ) external
```
Withdraws surplus, unmanaged tokens from the contract

Tokens in the contract over outstanding amount are considered as surplus

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_amount` | uint256 | Amount of tokens to withdraw

### revoke
```solidity
  function revoke(
  ) external
```
Revokes a vesting schedule and return the unvested tokens to the owner

Vesting schedule is always calculated based on managed tokens


## Events
### TokensReleased
```solidity
  event TokensReleased(
  )
```



### TokensWithdrawn
```solidity
  event TokensWithdrawn(
  )
```



### TokensRevoked
```solidity
  event TokensRevoked(
  )
```



### BeneficiaryChanged
```solidity
  event BeneficiaryChanged(
  )
```



### LockAccepted
```solidity
  event LockAccepted(
  )
```



### LockCanceled
```solidity
  event LockCanceled(
  )
```
