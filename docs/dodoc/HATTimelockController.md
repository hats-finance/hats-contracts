# HATTimelockController









## Methods

### CANCELLER_ROLE

```solidity
function CANCELLER_ROLE() external view returns (bytes32)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined |

### DEFAULT_ADMIN_ROLE

```solidity
function DEFAULT_ADMIN_ROLE() external view returns (bytes32)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined |

### EXECUTOR_ROLE

```solidity
function EXECUTOR_ROLE() external view returns (bytes32)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined |

### PROPOSER_ROLE

```solidity
function PROPOSER_ROLE() external view returns (bytes32)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined |

### TIMELOCK_ADMIN_ROLE

```solidity
function TIMELOCK_ADMIN_ROLE() external view returns (bytes32)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined |

### approveClaim

```solidity
function approveClaim(contract HATGovernanceArbitrator _arbitrator, contract IHATClaimsManager _claimsManager, bytes32 _claimId) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _arbitrator | contract HATGovernanceArbitrator | undefined |
| _claimsManager | contract IHATClaimsManager | undefined |
| _claimId | bytes32 | undefined |

### cancel

```solidity
function cancel(bytes32 id) external nonpayable
```



*Cancel an operation. Requirements: - the caller must have the &#39;canceller&#39; role.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| id | bytes32 | undefined |

### dismissClaim

```solidity
function dismissClaim(contract HATGovernanceArbitrator _arbitrator, contract IHATClaimsManager _claimsManager, bytes32 _claimId) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _arbitrator | contract HATGovernanceArbitrator | undefined |
| _claimsManager | contract IHATClaimsManager | undefined |
| _claimId | bytes32 | undefined |

### execute

```solidity
function execute(address target, uint256 value, bytes payload, bytes32 predecessor, bytes32 salt) external payable
```



*Execute an (ready) operation containing a single transaction. Emits a {CallExecuted} event. Requirements: - the caller must have the &#39;executor&#39; role.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| target | address | undefined |
| value | uint256 | undefined |
| payload | bytes | undefined |
| predecessor | bytes32 | undefined |
| salt | bytes32 | undefined |

### executeBatch

```solidity
function executeBatch(address[] targets, uint256[] values, bytes[] payloads, bytes32 predecessor, bytes32 salt) external payable
```



*Execute an (ready) operation containing a batch of transactions. Emits one {CallExecuted} event per transaction in the batch. Requirements: - the caller must have the &#39;executor&#39; role.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| targets | address[] | undefined |
| values | uint256[] | undefined |
| payloads | bytes[] | undefined |
| predecessor | bytes32 | undefined |
| salt | bytes32 | undefined |

### getMinDelay

```solidity
function getMinDelay() external view returns (uint256 duration)
```



*Returns the minimum delay for an operation to become valid. This value can be changed by executing an operation that calls `updateDelay`.*


#### Returns

| Name | Type | Description |
|---|---|---|
| duration | uint256 | undefined |

### getRoleAdmin

```solidity
function getRoleAdmin(bytes32 role) external view returns (bytes32)
```



*Returns the admin role that controls `role`. See {grantRole} and {revokeRole}. To change a role&#39;s admin, use {_setRoleAdmin}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| role | bytes32 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined |

### getTimestamp

```solidity
function getTimestamp(bytes32 id) external view returns (uint256 timestamp)
```



*Returns the timestamp at with an operation becomes ready (0 for unset operations, 1 for done operations).*

#### Parameters

| Name | Type | Description |
|---|---|---|
| id | bytes32 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| timestamp | uint256 | undefined |

### grantRole

```solidity
function grantRole(bytes32 role, address account) external nonpayable
```



*Grants `role` to `account`. If `account` had not been already granted `role`, emits a {RoleGranted} event. Requirements: - the caller must have ``role``&#39;s admin role. May emit a {RoleGranted} event.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| role | bytes32 | undefined |
| account | address | undefined |

### hasRole

```solidity
function hasRole(bytes32 role, address account) external view returns (bool)
```



*Returns `true` if `account` has been granted `role`.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| role | bytes32 | undefined |
| account | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### hashOperation

```solidity
function hashOperation(address target, uint256 value, bytes data, bytes32 predecessor, bytes32 salt) external pure returns (bytes32 hash)
```



*Returns the identifier of an operation containing a single transaction.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| target | address | undefined |
| value | uint256 | undefined |
| data | bytes | undefined |
| predecessor | bytes32 | undefined |
| salt | bytes32 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| hash | bytes32 | undefined |

### hashOperationBatch

```solidity
function hashOperationBatch(address[] targets, uint256[] values, bytes[] payloads, bytes32 predecessor, bytes32 salt) external pure returns (bytes32 hash)
```



*Returns the identifier of an operation containing a batch of transactions.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| targets | address[] | undefined |
| values | uint256[] | undefined |
| payloads | bytes[] | undefined |
| predecessor | bytes32 | undefined |
| salt | bytes32 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| hash | bytes32 | undefined |

### isOperation

```solidity
function isOperation(bytes32 id) external view returns (bool registered)
```



*Returns whether an id correspond to a registered operation. This includes both Pending, Ready and Done operations.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| id | bytes32 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| registered | bool | undefined |

### isOperationDone

```solidity
function isOperationDone(bytes32 id) external view returns (bool done)
```



*Returns whether an operation is done or not.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| id | bytes32 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| done | bool | undefined |

### isOperationPending

```solidity
function isOperationPending(bytes32 id) external view returns (bool pending)
```



*Returns whether an operation is pending or not.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| id | bytes32 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| pending | bool | undefined |

### isOperationReady

```solidity
function isOperationReady(bytes32 id) external view returns (bool ready)
```



*Returns whether an operation is ready or not.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| id | bytes32 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| ready | bool | undefined |

### onERC1155BatchReceived

```solidity
function onERC1155BatchReceived(address, address, uint256[], uint256[], bytes) external nonpayable returns (bytes4)
```



*See {IERC1155Receiver-onERC1155BatchReceived}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |
| _1 | address | undefined |
| _2 | uint256[] | undefined |
| _3 | uint256[] | undefined |
| _4 | bytes | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes4 | undefined |

### onERC1155Received

```solidity
function onERC1155Received(address, address, uint256, uint256, bytes) external nonpayable returns (bytes4)
```



*See {IERC1155Receiver-onERC1155Received}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |
| _1 | address | undefined |
| _2 | uint256 | undefined |
| _3 | uint256 | undefined |
| _4 | bytes | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes4 | undefined |

### onERC721Received

```solidity
function onERC721Received(address, address, uint256, bytes) external nonpayable returns (bytes4)
```



*See {IERC721Receiver-onERC721Received}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |
| _1 | address | undefined |
| _2 | uint256 | undefined |
| _3 | bytes | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes4 | undefined |

### renounceRole

```solidity
function renounceRole(bytes32 role, address account) external nonpayable
```



*Revokes `role` from the calling account. Roles are often managed via {grantRole} and {revokeRole}: this function&#39;s purpose is to provide a mechanism for accounts to lose their privileges if they are compromised (such as when a trusted device is misplaced). If the calling account had been revoked `role`, emits a {RoleRevoked} event. Requirements: - the caller must be `account`. May emit a {RoleRevoked} event.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| role | bytes32 | undefined |
| account | address | undefined |

### revokeRole

```solidity
function revokeRole(bytes32 role, address account) external nonpayable
```



*Revokes `role` from `account`. If `account` had been granted `role`, emits a {RoleRevoked} event. Requirements: - the caller must have ``role``&#39;s admin role. May emit a {RoleRevoked} event.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| role | bytes32 | undefined |
| account | address | undefined |

### schedule

```solidity
function schedule(address target, uint256 value, bytes data, bytes32 predecessor, bytes32 salt, uint256 delay) external nonpayable
```



*Schedule an operation containing a single transaction. Emits a {CallScheduled} event. Requirements: - the caller must have the &#39;proposer&#39; role.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| target | address | undefined |
| value | uint256 | undefined |
| data | bytes | undefined |
| predecessor | bytes32 | undefined |
| salt | bytes32 | undefined |
| delay | uint256 | undefined |

### scheduleBatch

```solidity
function scheduleBatch(address[] targets, uint256[] values, bytes[] payloads, bytes32 predecessor, bytes32 salt, uint256 delay) external nonpayable
```



*Schedule an operation containing a batch of transactions. Emits one {CallScheduled} event per transaction in the batch. Requirements: - the caller must have the &#39;proposer&#39; role.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| targets | address[] | undefined |
| values | uint256[] | undefined |
| payloads | bytes[] | undefined |
| predecessor | bytes32 | undefined |
| salt | bytes32 | undefined |
| delay | uint256 | undefined |

### setAllocPoint

```solidity
function setAllocPoint(contract IHATVault _vault, contract IRewardController _rewardController, uint256 _allocPoint) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract IHATVault | undefined |
| _rewardController | contract IRewardController | undefined |
| _allocPoint | uint256 | undefined |

### setCommittee

```solidity
function setCommittee(contract IHATClaimsManager _claimsManager, address _committee) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimsManager | contract IHATClaimsManager | undefined |
| _committee | address | undefined |

### setDepositPause

```solidity
function setDepositPause(contract IHATVault _vault, bool _depositPause) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract IHATVault | undefined |
| _depositPause | bool | undefined |

### setEmergencyPaused

```solidity
function setEmergencyPaused(contract IHATVaultsRegistry _registry, bool _isEmergencyPaused) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _registry | contract IHATVaultsRegistry | undefined |
| _isEmergencyPaused | bool | undefined |

### setVaultDescription

```solidity
function setVaultDescription(contract IHATVault _vault, string _descriptionHash) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract IHATVault | undefined |
| _descriptionHash | string | undefined |

### setVaultVisibility

```solidity
function setVaultVisibility(contract IHATVault _vault, bool _visible) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract IHATVault | undefined |
| _visible | bool | undefined |

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

### updateDelay

```solidity
function updateDelay(uint256 newDelay) external nonpayable
```



*Changes the minimum timelock duration for future operations. Emits a {MinDelayChange} event. Requirements: - the caller must be the timelock itself. This can only be achieved by scheduling and later executing an operation where the timelock is the target and the data is the ABI-encoded call to this function.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| newDelay | uint256 | undefined |



## Events

### CallExecuted

```solidity
event CallExecuted(bytes32 indexed id, uint256 indexed index, address target, uint256 value, bytes data)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| id `indexed` | bytes32 | undefined |
| index `indexed` | uint256 | undefined |
| target  | address | undefined |
| value  | uint256 | undefined |
| data  | bytes | undefined |

### CallScheduled

```solidity
event CallScheduled(bytes32 indexed id, uint256 indexed index, address target, uint256 value, bytes data, bytes32 predecessor, uint256 delay)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| id `indexed` | bytes32 | undefined |
| index `indexed` | uint256 | undefined |
| target  | address | undefined |
| value  | uint256 | undefined |
| data  | bytes | undefined |
| predecessor  | bytes32 | undefined |
| delay  | uint256 | undefined |

### Cancelled

```solidity
event Cancelled(bytes32 indexed id)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| id `indexed` | bytes32 | undefined |

### MinDelayChange

```solidity
event MinDelayChange(uint256 oldDuration, uint256 newDuration)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| oldDuration  | uint256 | undefined |
| newDuration  | uint256 | undefined |

### RoleAdminChanged

```solidity
event RoleAdminChanged(bytes32 indexed role, bytes32 indexed previousAdminRole, bytes32 indexed newAdminRole)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| role `indexed` | bytes32 | undefined |
| previousAdminRole `indexed` | bytes32 | undefined |
| newAdminRole `indexed` | bytes32 | undefined |

### RoleGranted

```solidity
event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| role `indexed` | bytes32 | undefined |
| account `indexed` | address | undefined |
| sender `indexed` | address | undefined |

### RoleRevoked

```solidity
event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| role `indexed` | bytes32 | undefined |
| account `indexed` | address | undefined |
| sender `indexed` | address | undefined |



