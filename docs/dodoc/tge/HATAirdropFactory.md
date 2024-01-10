# HATAirdropFactory









## Methods

### createHATAirdrop

```solidity
function createHATAirdrop(address _implementation, string _merkleTreeIPFSRef, bytes32 _root, uint256 _startTime, uint256 _deadline, uint256 _lockEndTime, uint256 _periods, uint256 _totalAmount, contract IERC20Upgradeable _token, contract ITokenLockFactory _tokenLockFactory) external nonpayable returns (address result)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _implementation | address | undefined |
| _merkleTreeIPFSRef | string | undefined |
| _root | bytes32 | undefined |
| _startTime | uint256 | undefined |
| _deadline | uint256 | undefined |
| _lockEndTime | uint256 | undefined |
| _periods | uint256 | undefined |
| _totalAmount | uint256 | undefined |
| _token | contract IERC20Upgradeable | undefined |
| _tokenLockFactory | contract ITokenLockFactory | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| result | address | undefined |

### owner

```solidity
function owner() external view returns (address)
```



*Returns the address of the current owner.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### predictHATAirdropAddress

```solidity
function predictHATAirdropAddress(address _implementation, string _merkleTreeIPFSRef, bytes32 _root, uint256 _startTime, uint256 _deadline, uint256 _lockEndTime, uint256 _periods, contract IERC20 _token, contract ITokenLockFactory _tokenLockFactory) external view returns (address)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _implementation | address | undefined |
| _merkleTreeIPFSRef | string | undefined |
| _root | bytes32 | undefined |
| _startTime | uint256 | undefined |
| _deadline | uint256 | undefined |
| _lockEndTime | uint256 | undefined |
| _periods | uint256 | undefined |
| _token | contract IERC20 | undefined |
| _tokenLockFactory | contract ITokenLockFactory | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### renounceOwnership

```solidity
function renounceOwnership() external nonpayable
```



*Leaves the contract without owner. It will not be possible to call `onlyOwner` functions anymore. Can only be called by the current owner. NOTE: Renouncing ownership will leave the contract without an owner, thereby removing any functionality that is only available to the owner.*


### transferOwnership

```solidity
function transferOwnership(address newOwner) external nonpayable
```



*Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| newOwner | address | undefined |

### withdrawTokens

```solidity
function withdrawTokens(contract IERC20Upgradeable _token, uint256 _amount) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _token | contract IERC20Upgradeable | undefined |
| _amount | uint256 | undefined |



## Events

### HATAirdropCreated

```solidity
event HATAirdropCreated(address indexed _hatAirdrop, string _merkleTreeIPFSRef, bytes32 _root, uint256 _startTime, uint256 _deadline, uint256 _lockEndTime, uint256 _periods, uint256 _totalAmount, contract IERC20Upgradeable _token, contract ITokenLockFactory _tokenLockFactory)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _hatAirdrop `indexed` | address | undefined |
| _merkleTreeIPFSRef  | string | undefined |
| _root  | bytes32 | undefined |
| _startTime  | uint256 | undefined |
| _deadline  | uint256 | undefined |
| _lockEndTime  | uint256 | undefined |
| _periods  | uint256 | undefined |
| _totalAmount  | uint256 | undefined |
| _token  | contract IERC20Upgradeable | undefined |
| _tokenLockFactory  | contract ITokenLockFactory | undefined |

### OwnershipTransferred

```solidity
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| previousOwner `indexed` | address | undefined |
| newOwner `indexed` | address | undefined |

### TokensWithdrawn

```solidity
event TokensWithdrawn(address indexed _owner, uint256 _amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _owner `indexed` | address | undefined |
| _amount  | uint256 | undefined |



