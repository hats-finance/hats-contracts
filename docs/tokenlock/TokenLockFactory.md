



## Functions
### constructor
```solidity
  function constructor(
    address _masterCopy
  ) public
```
Constructor.


#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_masterCopy` | address | Address of the master copy to use to clone proxies

### createTokenLock
```solidity
  function createTokenLock(
    address _token,
    address _owner,
    address _beneficiary,
    uint256 _managedAmount,
    uint256 _startTime,
    uint256 _endTime,
    uint256 _periods,
    uint256 _releaseStartTime,
    uint256 _revocable,
    enum ITokenLock.Revocability _canDelegate
  ) external returns (address contractAddress)
```
Creates and fund a new token lock wallet using a minimum proxy


#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_token` | address | token to time lock
|`_owner` | address | Address of the contract owner
|`_beneficiary` | address | Address of the beneficiary of locked tokens
|`_managedAmount` | uint256 | Amount of tokens to be managed by the lock contract
|`_startTime` | uint256 | Start time of the release schedule
|`_endTime` | uint256 | End time of the release schedule
|`_periods` | uint256 | Number of periods between start time and end time
|`_releaseStartTime` | uint256 | Override time for when the releases start
|`_revocable` | uint256 | Whether the contract is revocable
|`_canDelegate` | enum ITokenLock.Revocability | Whether the contract should call delegate

### setMasterCopy
```solidity
  function setMasterCopy(
    address _masterCopy
  ) public
```
Sets the masterCopy bytecode to use to create clones of TokenLock contracts


#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_masterCopy` | address | Address of contract bytecode to factory clone

## Events
### MasterCopyUpdated
```solidity
  event MasterCopyUpdated(
  )
```



### TokenLockCreated
```solidity
  event TokenLockCreated(
  )
```



