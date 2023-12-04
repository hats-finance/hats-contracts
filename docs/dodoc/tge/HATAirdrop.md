# HATAirdrop









## Methods

### deadline

```solidity
function deadline() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### leafRedeemed

```solidity
function leafRedeemed(bytes32) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined |

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

### periods

```solidity
function periods() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### recoverTokens

```solidity
function recoverTokens() external nonpayable
```






### redeem

```solidity
function redeem(address _account, uint256 _amount, bytes32[] _proof) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _account | address | undefined |
| _amount | uint256 | undefined |
| _proof | bytes32[] | undefined |

### renounceOwnership

```solidity
function renounceOwnership() external nonpayable
```



*Leaves the contract without owner. It will not be possible to call `onlyOwner` functions anymore. Can only be called by the current owner. NOTE: Renouncing ownership will leave the contract without an owner, thereby removing any functionality that is only available to the owner.*


### root

```solidity
function root() external view returns (bytes32)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined |

### startTime

```solidity
function startTime() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### token

```solidity
function token() external view returns (contract IERC20)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IERC20 | undefined |

### tokenLockFactory

```solidity
function tokenLockFactory() external view returns (contract TokenLockFactory)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract TokenLockFactory | undefined |

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

### MerkleTreeSet

```solidity
event MerkleTreeSet(string _merkleTreeIPFSRef, bytes32 _root, uint256 _startTime, uint256 _deadline)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _merkleTreeIPFSRef  | string | undefined |
| _root  | bytes32 | undefined |
| _startTime  | uint256 | undefined |
| _deadline  | uint256 | undefined |

### OwnershipTransferred

```solidity
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| previousOwner `indexed` | address | undefined |
| newOwner `indexed` | address | undefined |

### TokensRecovered

```solidity
event TokensRecovered(address indexed _owner, uint256 _amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _owner `indexed` | address | undefined |
| _amount  | uint256 | undefined |

### TokensRedeemed

```solidity
event TokensRedeemed(address indexed _account, address indexed _tokenLock, uint256 _amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _account `indexed` | address | undefined |
| _tokenLock `indexed` | address | undefined |
| _amount  | uint256 | undefined |



## Errors

### CannotRecoverBeforeDeadline

```solidity
error CannotRecoverBeforeDeadline()
```






### CannotRedeemAfterDeadline

```solidity
error CannotRedeemAfterDeadline()
```






### CannotRedeemBeforeStartTime

```solidity
error CannotRedeemBeforeStartTime()
```






### InvalidMerkleProof

```solidity
error InvalidMerkleProof()
```






### LeafAlreadyRedeemed

```solidity
error LeafAlreadyRedeemed()
```







