# HATHackersNFT









## Methods

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

### exists

```solidity
function exists(uint256 id) external view returns (bool)
```



*Indicates whether any token exist with a given id, or not.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| id | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### getTokenId

```solidity
function getTokenId(string _ipfsHash) external pure returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _ipfsHash | string | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

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

### mint

```solidity
function mint(address _recipient, string _ipfsHash, uint256 _amount) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _recipient | address | undefined |
| _ipfsHash | string | undefined |
| _amount | uint256 | undefined |

### mintMultiple

```solidity
function mintMultiple(address[] _recipients, string[] _ipfsHashes, uint256[] _amounts) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _recipients | address[] | undefined |
| _ipfsHashes | string[] | undefined |
| _amounts | uint256[] | undefined |

### mintingStopped

```solidity
function mintingStopped(uint256) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

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

### renounceOwnership

```solidity
function renounceOwnership() external nonpayable
```



*Leaves the contract without owner. It will not be possible to call `onlyOwner` functions anymore. Can only be called by the current owner. NOTE: Renouncing ownership will leave the contract without an owner, thereby removing any functionality that is only available to the owner.*


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

### stopMint

```solidity
function stopMint(uint256 _tokenId) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _tokenId | uint256 | undefined |

### stopMintMultiple

```solidity
function stopMintMultiple(uint256[] _tokenIds) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _tokenIds | uint256[] | undefined |

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

### totalSupply

```solidity
function totalSupply(uint256 id) external view returns (uint256)
```



*Total amount of tokens in with a given id.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| id | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### transferOwnership

```solidity
function transferOwnership(address newOwner) external nonpayable
```



*Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| newOwner | address | undefined |

### uri

```solidity
function uri(uint256 _tokenId) external view returns (string)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _tokenId | uint256 | undefined |

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

### MintingStopped

```solidity
event MintingStopped(uint256 indexed _tokenId)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _tokenId `indexed` | uint256 | undefined |

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



## Errors

### MintArrayLengthMismatch

```solidity
error MintArrayLengthMismatch()
```






### MintingAlreadyStopped

```solidity
error MintingAlreadyStopped()
```






### MintingOfTokenStopped

```solidity
error MintingOfTokenStopped()
```






### TokenDoesNotExist

```solidity
error TokenDoesNotExist()
```







