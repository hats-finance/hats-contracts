# HATGovernanceArbitrator









## Methods

### approveClaim

```solidity
function approveClaim(contract HATVault _vault, bytes32 _claimId) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract HATVault | undefined |
| _claimId | bytes32 | undefined |

### dismissClaim

```solidity
function dismissClaim(contract HATVault _vault, bytes32 _claimId) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract HATVault | undefined |
| _claimId | bytes32 | undefined |

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



*Leaves the contract without owner. It will not be possible to call `onlyOwner` functions. Can only be called by the current owner. NOTE: Renouncing ownership will leave the contract without an owner, thereby disabling any functionality that is only available to the owner.*


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

### OwnershipTransferred

```solidity
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| previousOwner `indexed` | address | undefined |
| newOwner `indexed` | address | undefined |



