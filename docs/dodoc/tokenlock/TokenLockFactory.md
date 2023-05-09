# TokenLockFactory



> TokenLockFactory  a factory of TokenLock contracts. This contract receives funds to make the process of creating TokenLock contracts easier by distributing them the initial tokens to be managed.





## Methods

### createTokenLock

```solidity
function createTokenLock(address _token, address _owner, address _beneficiary, uint256 _managedAmount, uint256 _startTime, uint256 _endTime, uint256 _periods, uint256 _releaseStartTime, uint256 _vestingCliffTime, enum ITokenLock.Revocability _revocable, bool _canDelegate) external nonpayable returns (address contractAddress)
```

Creates and fund a new token lock wallet using a minimum proxy



#### Parameters

| Name | Type | Description |
|---|---|---|
| _token | address | token to time lock |
| _owner | address | Address of the contract owner |
| _beneficiary | address | Address of the beneficiary of locked tokens |
| _managedAmount | uint256 | Amount of tokens to be managed by the lock contract |
| _startTime | uint256 | Start time of the release schedule |
| _endTime | uint256 | End time of the release schedule |
| _periods | uint256 | Number of periods between start time and end time |
| _releaseStartTime | uint256 | Override time for when the releases start |
| _vestingCliffTime | uint256 | undefined |
| _revocable | enum ITokenLock.Revocability | Whether the contract is revocable |
| _canDelegate | bool | Whether the contract should call delegate |

#### Returns

| Name | Type | Description |
|---|---|---|
| contractAddress | address | undefined |

### masterCopy

```solidity
function masterCopy() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### nonce

```solidity
function nonce(address) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

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

### renounceOwnership

```solidity
function renounceOwnership() external nonpayable
```



*Leaves the contract without owner. It will not be possible to call `onlyOwner` functions anymore. Can only be called by the current owner. NOTE: Renouncing ownership will leave the contract without an owner, thereby removing any functionality that is only available to the owner.*


### setMasterCopy

```solidity
function setMasterCopy(address _masterCopy) external nonpayable
```

Sets the masterCopy bytecode to use to create clones of TokenLock contracts



#### Parameters

| Name | Type | Description |
|---|---|---|
| _masterCopy | address | Address of contract bytecode to factory clone |

### transferOwnership

```solidity
function transferOwnership(address newOwner) external nonpayable
```



*Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| newOwner | address | undefined |



## Events

### MasterCopyUpdated

```solidity
event MasterCopyUpdated(address indexed masterCopy)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| masterCopy `indexed` | address | undefined |

### OwnershipTransferred

```solidity
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| previousOwner `indexed` | address | undefined |
| newOwner `indexed` | address | undefined |

### TokenLockCreated

```solidity
event TokenLockCreated(address indexed contractAddress, bytes32 indexed initHash, address indexed beneficiary, address token, uint256 managedAmount, uint256 startTime, uint256 endTime, uint256 periods, uint256 releaseStartTime, uint256 vestingCliffTime, enum ITokenLock.Revocability revocable, bool canDelegate)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| contractAddress `indexed` | address | undefined |
| initHash `indexed` | bytes32 | undefined |
| beneficiary `indexed` | address | undefined |
| token  | address | undefined |
| managedAmount  | uint256 | undefined |
| startTime  | uint256 | undefined |
| endTime  | uint256 | undefined |
| periods  | uint256 | undefined |
| releaseStartTime  | uint256 | undefined |
| vestingCliffTime  | uint256 | undefined |
| revocable  | enum ITokenLock.Revocability | undefined |
| canDelegate  | bool | undefined |



