# IRewardController









## Methods

### claimReward

```solidity
function claimReward(address _vault, address _user) external nonpayable
```

Transfer to the specified user their pending share of rewards.



#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | address | The vault address |
| _user | address | The user address to claim for |

### commitUserBalance

```solidity
function commitUserBalance(address _user, uint256 _sharesChange, bool _isDeposit) external nonpayable
```

Called by the vault to update a user claimable reward after deposit or withdraw. This call should never revert.



#### Parameters

| Name | Type | Description |
|---|---|---|
| _user | address | The user address to updare rewards for |
| _sharesChange | uint256 | The user of shared the user deposited or withdrew |
| _isDeposit | bool | Whether user deposited or withdrew |

### getPendingReward

```solidity
function getPendingReward(address _vault, address _user) external view returns (uint256)
```

Calculate the amount of rewards a user can claim for having contributed to a specific vault



#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | address | The vault address |
| _user | address | The user for which the reward is calculated |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### getVaultReward

```solidity
function getVaultReward(address _vault, uint256 _fromBlock) external view returns (uint256 reward)
```

Calculate rewards for a vault by iterating over the history of totalAllocPoints updates, and sum up all rewards periods from vault.lastRewardBlock until current block number.



#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | address | The vault address |
| _fromBlock | uint256 | The block from which to start calculation |

#### Returns

| Name | Type | Description |
|---|---|---|
| reward | uint256 | The amount of rewards for the vault |

### initialize

```solidity
function initialize(address _rewardToken, address _governance, uint256 _startRewardingBlock, uint256 _epochLength, uint256[24] _epochRewardPerBlock) external nonpayable
```

Initializes the reward controller



#### Parameters

| Name | Type | Description |
|---|---|---|
| _rewardToken | address | The address of the ERC20 token to be distributed as rewards |
| _governance | address | The hats governance address, to be given ownership of the reward controller |
| _startRewardingBlock | uint256 | The block number from which to start rewarding |
| _epochLength | uint256 | The length of a rewarding epoch |
| _epochRewardPerBlock | uint256[24] | The reward per block for each of the 24 epochs |

### setAllocPoint

```solidity
function setAllocPoint(address _vault, uint256 _allocPoint) external nonpayable
```

Called by the owner to set the allocation points for a vault, meaning the vault&#39;s relative share of the total rewards



#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | address | The address of the vault |
| _allocPoint | uint256 | The allocation points for the vault |

### setEpochRewardPerBlock

```solidity
function setEpochRewardPerBlock(uint256[24] _epochRewardPerBlock) external nonpayable
```

Called by the owner to set reward per epoch Reward can only be set for epochs which have not yet started



#### Parameters

| Name | Type | Description |
|---|---|---|
| _epochRewardPerBlock | uint256[24] | reward per block for each epoch |

### sweepToken

```solidity
function sweepToken(contract IERC20Upgradeable _token, uint256 _amount) external nonpayable
```

Called by the owner to transfer any tokens held in this contract to the owner



#### Parameters

| Name | Type | Description |
|---|---|---|
| _token | contract IERC20Upgradeable | The token to sweep |
| _amount | uint256 | The amount of token to sweep |

### updateVault

```solidity
function updateVault(address _vault) external nonpayable
```

Update the vault&#39;s reward per share, not more then once per block



#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | address | The vault&#39;s address |



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







