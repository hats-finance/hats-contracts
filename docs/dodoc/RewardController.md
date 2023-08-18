# RewardController









## Methods

### NUMBER_OF_EPOCHS

```solidity
function NUMBER_OF_EPOCHS() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### REWARD_PRECISION

```solidity
function REWARD_PRECISION() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### claimReward

```solidity
function claimReward(address _vault, address _user) external nonpayable
```

See {IRewardController-claimReward}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | address | undefined |
| _user | address | undefined |

### commitUserBalance

```solidity
function commitUserBalance(address _user, uint256 _sharesChange, bool _isDeposit) external nonpayable
```

See {IRewardController-commitUserBalance}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _user | address | undefined |
| _sharesChange | uint256 | undefined |
| _isDeposit | bool | undefined |

### epochLength

```solidity
function epochLength() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### epochRewardPerBlock

```solidity
function epochRewardPerBlock(uint256) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### getGlobalVaultsUpdatesLength

```solidity
function getGlobalVaultsUpdatesLength() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### getPendingReward

```solidity
function getPendingReward(address _vault, address _user) external view returns (uint256)
```

See {IRewardController-getPendingReward}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | address | undefined |
| _user | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### getRewardForBlocksRange

```solidity
function getRewardForBlocksRange(uint256 _fromBlock, uint256 _toBlock, uint256 _allocPoint, uint256 _totalAllocPoint) external view returns (uint256 reward)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _fromBlock | uint256 | undefined |
| _toBlock | uint256 | undefined |
| _allocPoint | uint256 | undefined |
| _totalAllocPoint | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| reward | uint256 | undefined |

### getVaultReward

```solidity
function getVaultReward(address _vault, uint256 _fromBlock) external view returns (uint256 reward)
```

See {IRewardController-getVaultReward}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | address | undefined |
| _fromBlock | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| reward | uint256 | undefined |

### globalVaultsUpdates

```solidity
function globalVaultsUpdates(uint256) external view returns (uint256 blockNumber, uint256 totalAllocPoint)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| blockNumber | uint256 | undefined |
| totalAllocPoint | uint256 | undefined |

### initialize

```solidity
function initialize(address _rewardToken, address _governance, uint256 _startRewardingBlock, uint256 _epochLength, uint256[24] _epochRewardPerBlock) external nonpayable
```

See {IRewardController-initialize}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _rewardToken | address | undefined |
| _governance | address | undefined |
| _startRewardingBlock | uint256 | undefined |
| _epochLength | uint256 | undefined |
| _epochRewardPerBlock | uint256[24] | undefined |

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


### rewardDebt

```solidity
function rewardDebt(address, address) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |
| _1 | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### rewardToken

```solidity
function rewardToken() external view returns (contract IERC20Upgradeable)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IERC20Upgradeable | undefined |

### setAllocPoint

```solidity
function setAllocPoint(address _vault, uint256 _allocPoint) external nonpayable
```

See {IRewardController-setAllocPoint}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | address | undefined |
| _allocPoint | uint256 | undefined |

### setEpochRewardPerBlock

```solidity
function setEpochRewardPerBlock(uint256[24] _epochRewardPerBlock) external nonpayable
```

See {IRewardController-setEpochRewardPerBlock}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _epochRewardPerBlock | uint256[24] | undefined |

### startBlock

```solidity
function startBlock() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### sweepToken

```solidity
function sweepToken(contract IERC20Upgradeable _token, uint256 _amount) external nonpayable
```

See {IRewardController-sweepToken}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _token | contract IERC20Upgradeable | undefined |
| _amount | uint256 | undefined |

### transferOwnership

```solidity
function transferOwnership(address newOwner) external nonpayable
```



*Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| newOwner | address | undefined |

### unclaimedReward

```solidity
function unclaimedReward(address, address) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |
| _1 | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### updateVault

```solidity
function updateVault(address _vault) external nonpayable
```

See {IRewardController-updateVault}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | address | undefined |

### vaultInfo

```solidity
function vaultInfo(address) external view returns (uint256 rewardPerShare, uint256 lastProcessedVaultUpdate, uint256 lastRewardBlock, uint256 allocPoint)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| rewardPerShare | uint256 | undefined |
| lastProcessedVaultUpdate | uint256 | undefined |
| lastRewardBlock | uint256 | undefined |
| allocPoint | uint256 | undefined |



## Events

### ClaimReward

```solidity
event ClaimReward(address indexed _vault, address indexed _user, uint256 _amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault `indexed` | address | undefined |
| _user `indexed` | address | undefined |
| _amount  | uint256 | undefined |

### Initialized

```solidity
event Initialized(uint8 version)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| version  | uint8 | undefined |

### OwnershipTransferred

```solidity
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| previousOwner `indexed` | address | undefined |
| newOwner `indexed` | address | undefined |

### RewardControllerCreated

```solidity
event RewardControllerCreated(address _rewardToken, address _governance, uint256 _startBlock, uint256 _epochLength, uint256[24] _epochRewardPerBlock)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _rewardToken  | address | undefined |
| _governance  | address | undefined |
| _startBlock  | uint256 | undefined |
| _epochLength  | uint256 | undefined |
| _epochRewardPerBlock  | uint256[24] | undefined |

### SetAllocPoint

```solidity
event SetAllocPoint(address indexed _vault, uint256 _prevAllocPoint, uint256 _allocPoint)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault `indexed` | address | undefined |
| _prevAllocPoint  | uint256 | undefined |
| _allocPoint  | uint256 | undefined |

### SetEpochRewardPerBlock

```solidity
event SetEpochRewardPerBlock(uint256[24] _epochRewardPerBlock)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _epochRewardPerBlock  | uint256[24] | undefined |

### UserBalanceCommitted

```solidity
event UserBalanceCommitted(address indexed _vault, address indexed _user, uint256 _unclaimedReward, uint256 _rewardDebt)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault `indexed` | address | undefined |
| _user `indexed` | address | undefined |
| _unclaimedReward  | uint256 | undefined |
| _rewardDebt  | uint256 | undefined |

### VaultUpdated

```solidity
event VaultUpdated(address indexed _vault, uint256 _rewardPerShare, uint256 _lastProcessedVaultUpdate)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault `indexed` | address | undefined |
| _rewardPerShare  | uint256 | undefined |
| _lastProcessedVaultUpdate  | uint256 | undefined |



## Errors

### EpochLengthZero

```solidity
error EpochLengthZero()
```






### NotEnoughRewardsToTransferToUser

```solidity
error NotEnoughRewardsToTransferToUser()
```







