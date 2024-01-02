# HATAirdropFactory









## Methods

### createHATAirdrop

```solidity
function createHATAirdrop(address _owner, string _merkleTreeIPFSRef, bytes32 _root, uint256 _startTime, uint256 _deadline, uint256 _lockEndTime, uint256 _periods, contract IERC20Upgradeable _token, contract ITokenLockFactory _tokenLockFactory) external nonpayable returns (address result)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _owner | address | undefined |
| _merkleTreeIPFSRef | string | undefined |
| _root | bytes32 | undefined |
| _startTime | uint256 | undefined |
| _deadline | uint256 | undefined |
| _lockEndTime | uint256 | undefined |
| _periods | uint256 | undefined |
| _token | contract IERC20Upgradeable | undefined |
| _tokenLockFactory | contract ITokenLockFactory | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| result | address | undefined |

### implementation

```solidity
function implementation() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### predictHATAirdropAddress

```solidity
function predictHATAirdropAddress(address _owner, string _merkleTreeIPFSRef, bytes32 _root, uint256 _startTime, uint256 _deadline, uint256 _lockEndTime, uint256 _periods, contract IERC20 _token, contract ITokenLockFactory _tokenLockFactory) external view returns (address)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _owner | address | undefined |
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



## Events

### HATAirdropCreated

```solidity
event HATAirdropCreated(address indexed _hatAirdrop)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _hatAirdrop `indexed` | address | undefined |



