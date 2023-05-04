# VaultsManagerMock









## Methods

### claimDifferentPids

```solidity
function claimDifferentPids(contract RewardController _target, address[] _vaults) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _target | contract RewardController | undefined |
| _vaults | address[] | undefined |

### claimRewardTwice

```solidity
function claimRewardTwice(contract RewardController target, address _vault) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| target | contract RewardController | undefined |
| _vault | address | undefined |

### createVaults

```solidity
function createVaults(contract HATVaultsRegistry _hatVaults, contract IRewardController _rewardController, uint256 _allocPoint, contract IERC20[] _assets, address _committee, uint16 _maxBounty, IHATClaimsManager.BountySplit _bountySplit, string _descriptionHash) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _hatVaults | contract HATVaultsRegistry | undefined |
| _rewardController | contract IRewardController | undefined |
| _allocPoint | uint256 | undefined |
| _assets | contract IERC20[] | undefined |
| _committee | address | undefined |
| _maxBounty | uint16 | undefined |
| _bountySplit | IHATClaimsManager.BountySplit | undefined |
| _descriptionHash | string | undefined |

### deposit

```solidity
function deposit(contract IHATVault _target, contract IERC20 _asset, uint256 _amount) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _target | contract IHATVault | undefined |
| _asset | contract IERC20 | undefined |
| _amount | uint256 | undefined |

### depositTwice

```solidity
function depositTwice(contract IHATVault _target, contract IERC20 _asset, uint256 _amount) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _target | contract IHATVault | undefined |
| _asset | contract IERC20 | undefined |
| _amount | uint256 | undefined |

### setVaultsAllocPoint

```solidity
function setVaultsAllocPoint(contract IHATVault[] _hatVaults, contract IRewardController _rewardController, uint256 _allocPoint) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _hatVaults | contract IHATVault[] | undefined |
| _rewardController | contract IRewardController | undefined |
| _allocPoint | uint256 | undefined |




