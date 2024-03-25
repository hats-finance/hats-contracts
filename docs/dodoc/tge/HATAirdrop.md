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

### factory

```solidity
function factory() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### initialize

```solidity
function initialize(string _merkleTreeIPFSRef, bytes32 _root, uint256 _startTime, uint256 _deadline, uint256 _lockEndTime, uint256 _periods, contract IERC20Upgradeable _token, contract ITokenLockFactory _tokenLockFactory) external nonpayable
```

Initialize a HATAirdrop instance



#### Parameters

| Name | Type | Description |
|---|---|---|
| _merkleTreeIPFSRef | string | new merkle tree ipfs reference. |
| _root | bytes32 | new merkle tree root to use for verifying airdrop data. |
| _startTime | uint256 | start of the redeem period and of the token lock (if exists) |
| _deadline | uint256 | end time to redeem from the contract |
| _lockEndTime | uint256 | end time for the token lock contract. If this date is in the past, the tokens will be transferred directly to the user and no token lock will be created |
| _periods | uint256 | number of periods of the token lock contract (if exists) |
| _token | contract IERC20Upgradeable | the token to be airdropped |
| _tokenLockFactory | contract ITokenLockFactory | the token lock factory to use to deploy the token locks |

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

### lockEndTime

```solidity
function lockEndTime() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### periods

```solidity
function periods() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

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
function token() external view returns (contract IERC20Upgradeable)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IERC20Upgradeable | undefined |

### tokenLockFactory

```solidity
function tokenLockFactory() external view returns (contract ITokenLockFactory)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract ITokenLockFactory | undefined |



## Events

### Initialized

```solidity
event Initialized(uint8 version)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| version  | uint8 | undefined |

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






### RedeemerMustBeBeneficiary

```solidity
error RedeemerMustBeBeneficiary()
```







