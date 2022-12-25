# HATVaultsNFT









## Methods

### HUNDRED_PERCENT

```solidity
function HUNDRED_PERCENT() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### TIERS

```solidity
function TIERS() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### addVault

```solidity
function addVault(address hatVaults, uint256 pid, string _uri) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| hatVaults | address | undefined |
| pid | uint256 | undefined |
| _uri | string | undefined |

### balanceOf

```solidity
function balanceOf(address account, uint256 id) external view returns (uint256)
```



*See {IERC1155-balanceOf}. Requirements: - `account` cannot be the zero address.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | undefined |
| id | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### balanceOfBatch

```solidity
function balanceOfBatch(address[] accounts, uint256[] ids) external view returns (uint256[])
```



*See {IERC1155-balanceOfBatch}. Requirements: - `accounts` and `ids` must have the same length.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| accounts | address[] | undefined |
| ids | uint256[] | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256[] | undefined |

### deadline

```solidity
function deadline() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### getTierFromShares

```solidity
function getTierFromShares(address hatVaults, uint256 pid, address account) external view returns (uint8)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| hatVaults | address | undefined |
| pid | uint256 | undefined |
| account | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint8 | undefined |

### getTiersToRedeemFromShares

```solidity
function getTiersToRedeemFromShares(address hatVaults, uint256 pid, address account) external view returns (bool[3] tiers)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| hatVaults | address | undefined |
| pid | uint256 | undefined |
| account | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| tiers | bool[3] | undefined |

### getTokenId

```solidity
function getTokenId(address hatVaults, uint256 pid, uint8 tier) external pure returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| hatVaults | address | undefined |
| pid | uint256 | undefined |
| tier | uint8 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### getVaultId

```solidity
function getVaultId(address hatVaults, uint256 pid) external pure returns (bytes32)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| hatVaults | address | undefined |
| pid | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined |

### isApprovedForAll

```solidity
function isApprovedForAll(address account, address operator) external view returns (bool)
```



*See {IERC1155-isApprovedForAll}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | undefined |
| operator | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### isEligible

```solidity
function isEligible(address hatVaults, uint256 pid, address account) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| hatVaults | address | undefined |
| pid | uint256 | undefined |
| account | address | undefined |

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

### pauseVault

```solidity
function pauseVault(address hatVaults, uint256 pid) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| hatVaults | address | undefined |
| pid | uint256 | undefined |

### pausedVaults

```solidity
function pausedVaults(bytes32) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### redeemMultipleFromShares

```solidity
function redeemMultipleFromShares(address[] hatVaults, uint256[] pids, address account) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| hatVaults | address[] | undefined |
| pids | uint256[] | undefined |
| account | address | undefined |

### redeemMultipleFromTree

```solidity
function redeemMultipleFromTree(address[] hatVaults, uint256[] pids, address account, uint8[] tiers, bytes32[][] proofs) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| hatVaults | address[] | undefined |
| pids | uint256[] | undefined |
| account | address | undefined |
| tiers | uint8[] | undefined |
| proofs | bytes32[][] | undefined |

### redeemSingleFromShares

```solidity
function redeemSingleFromShares(address hatVaults, uint256 pid, address account) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| hatVaults | address | undefined |
| pid | uint256 | undefined |
| account | address | undefined |

### redeemSingleFromTree

```solidity
function redeemSingleFromTree(address hatVaults, uint256 pid, address account, uint8 tier, bytes32[] proof) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| hatVaults | address | undefined |
| pid | uint256 | undefined |
| account | address | undefined |
| tier | uint8 | undefined |
| proof | bytes32[] | undefined |

### renounceOwnership

```solidity
function renounceOwnership() external nonpayable
```



*Leaves the contract without owner. It will not be possible to call `onlyOwner` functions anymore. Can only be called by the current owner. NOTE: Renouncing ownership will leave the contract without an owner, thereby removing any functionality that is only available to the owner.*


### resumeVault

```solidity
function resumeVault(address hatVaults, uint256 pid) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| hatVaults | address | undefined |
| pid | uint256 | undefined |

### root

```solidity
function root() external view returns (bytes32)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined |

### safeBatchTransferFrom

```solidity
function safeBatchTransferFrom(address from, address to, uint256[] ids, uint256[] amounts, bytes data) external nonpayable
```



*See {IERC1155-safeBatchTransferFrom}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| from | address | undefined |
| to | address | undefined |
| ids | uint256[] | undefined |
| amounts | uint256[] | undefined |
| data | bytes | undefined |

### safeTransferFrom

```solidity
function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data) external nonpayable
```



*See {IERC1155-safeTransferFrom}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| from | address | undefined |
| to | address | undefined |
| id | uint256 | undefined |
| amount | uint256 | undefined |
| data | bytes | undefined |

### setApprovalForAll

```solidity
function setApprovalForAll(address operator, bool approved) external nonpayable
```



*See {IERC1155-setApprovalForAll}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| operator | address | undefined |
| approved | bool | undefined |

### supportsInterface

```solidity
function supportsInterface(bytes4 interfaceId) external view returns (bool)
```



*See {IERC165-supportsInterface}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| interfaceId | bytes4 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### tokensRedeemed

```solidity
function tokensRedeemed(uint256, address) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |
| _1 | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### totalSupply

```solidity
function totalSupply() external view returns (uint256)
```



*Returns thze total tokens minted so far.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### totalSupplyCounter

```solidity
function totalSupplyCounter() external view returns (uint256 _value)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _value | uint256 | undefined |

### transferOwnership

```solidity
function transferOwnership(address newOwner) external nonpayable
```



*Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| newOwner | address | undefined |

### updateTree

```solidity
function updateTree(string _merkleTreeIPFSRef, bytes32 _root, uint256 _deadline) external nonpayable
```



*Update the merkle tree root only after  the deadline for minting has been reached.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _merkleTreeIPFSRef | string | new merkle tree ipfs reference. |
| _root | bytes32 | new merkle tree root to use for verifying. |
| _deadline | uint256 | number of days to the next minting deadline. |

### uri

```solidity
function uri(uint256 tokenId) external view returns (string)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| tokenId | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | string | undefined |

### uris

```solidity
function uris(uint256) external view returns (string)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | string | undefined |

### vaultsRegistered

```solidity
function vaultsRegistered(bytes32) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |



## Events

### ApprovalForAll

```solidity
event ApprovalForAll(address indexed account, address indexed operator, bool approved)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| account `indexed` | address | undefined |
| operator `indexed` | address | undefined |
| approved  | bool | undefined |

### MerkleTreeChanged

```solidity
event MerkleTreeChanged(string merkleTreeIPFSRef, bytes32 root, uint256 deadline)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| merkleTreeIPFSRef  | string | undefined |
| root  | bytes32 | undefined |
| deadline  | uint256 | undefined |

### OwnershipTransferred

```solidity
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| previousOwner `indexed` | address | undefined |
| newOwner `indexed` | address | undefined |

### TransferBatch

```solidity
event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| operator `indexed` | address | undefined |
| from `indexed` | address | undefined |
| to `indexed` | address | undefined |
| ids  | uint256[] | undefined |
| values  | uint256[] | undefined |

### TransferSingle

```solidity
event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| operator `indexed` | address | undefined |
| from `indexed` | address | undefined |
| to `indexed` | address | undefined |
| id  | uint256 | undefined |
| value  | uint256 | undefined |

### URI

```solidity
event URI(string value, uint256 indexed id)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| value  | string | undefined |
| id `indexed` | uint256 | undefined |

### VaultPaused

```solidity
event VaultPaused(address indexed hatVaults, uint256 indexed pid)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| hatVaults `indexed` | address | undefined |
| pid `indexed` | uint256 | undefined |

### VaultResumed

```solidity
event VaultResumed(address indexed hatVaults, uint256 indexed pid)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| hatVaults `indexed` | address | undefined |
| pid `indexed` | uint256 | undefined |



