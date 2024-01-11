# HATAirdropFactory









## Methods

### createHATAirdrop

```solidity
function createHATAirdrop(address _implementation, bytes _initData, contract IERC20 _token, uint256 _totalAmount) external nonpayable returns (address result)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _implementation | address | undefined |
| _initData | bytes | undefined |
| _token | contract IERC20 | undefined |
| _totalAmount | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| result | address | undefined |

### isAirdrop

```solidity
function isAirdrop(address) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

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
function predictHATAirdropAddress(address _implementation, bytes _initData) external view returns (address)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _implementation | address | undefined |
| _initData | bytes | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### redeemMultipleAirdrops

```solidity
function redeemMultipleAirdrops(contract IHATAirdrop[] _airdrops, uint256[] _amounts, bytes32[][] _proofs) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _airdrops | contract IHATAirdrop[] | undefined |
| _amounts | uint256[] | undefined |
| _proofs | bytes32[][] | undefined |

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
function withdrawTokens(contract IERC20 _token, uint256 _amount) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _token | contract IERC20 | undefined |
| _amount | uint256 | undefined |



## Events

### HATAirdropCreated

```solidity
event HATAirdropCreated(address indexed _hatAirdrop, bytes _initData, contract IERC20 _token, uint256 _totalAmount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _hatAirdrop `indexed` | address | undefined |
| _initData  | bytes | undefined |
| _token  | contract IERC20 | undefined |
| _totalAmount  | uint256 | undefined |

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



## Errors

### ContractIsNotHATAirdrop

```solidity
error ContractIsNotHATAirdrop()
```






### HATAirdropInitializationFailed

```solidity
error HATAirdropInitializationFailed()
```






### RedeemDataArraysLengthMismatch

```solidity
error RedeemDataArraysLengthMismatch()
```







