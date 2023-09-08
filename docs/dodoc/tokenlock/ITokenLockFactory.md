# ITokenLockFactory









## Methods

### createTokenLock

```solidity
function createTokenLock(address _token, address _owner, address _beneficiary, uint256 _managedAmount, uint256 _startTime, uint256 _endTime, uint256 _periods, uint256 _releaseStartTime, uint256 _vestingCliffTime, enum ITokenLock.Revocability _revocable, bool _canDelegate) external nonpayable returns (address contractAddress)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _token | address | undefined |
| _owner | address | undefined |
| _beneficiary | address | undefined |
| _managedAmount | uint256 | undefined |
| _startTime | uint256 | undefined |
| _endTime | uint256 | undefined |
| _periods | uint256 | undefined |
| _releaseStartTime | uint256 | undefined |
| _vestingCliffTime | uint256 | undefined |
| _revocable | enum ITokenLock.Revocability | undefined |
| _canDelegate | bool | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| contractAddress | address | undefined |

### setMasterCopy

```solidity
function setMasterCopy(address _masterCopy) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _masterCopy | address | undefined |




