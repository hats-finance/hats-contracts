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
function createVaults(contract HATVaultsRegistry _hatVaults, contract IRewardController _rewardController, uint256 _allocPoint, contract IERC20[] _assets, address _committee, uint16 _maxBounty, IHATVault.BountySplit _bountySplit, string _descriptionHash, uint32 _bountyVestingDuration, uint32 _bountyVestingPeriods) external nonpayable
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
| _bountySplit | IHATVault.BountySplit | undefined |
| _descriptionHash | string | undefined |
| _bountyVestingDuration | uint32 | undefined |
| _bountyVestingPeriods | uint32 | undefined |

### deposit

```solidity
function deposit(contract HATVault _target, contract IERC20 _asset, uint256 _amount) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _target | contract HATVault | undefined |
| _asset | contract IERC20 | undefined |
| _amount | uint256 | undefined |

### depositTwice

```solidity
function depositTwice(contract HATVault _target, contract IERC20 _asset, uint256 _amount) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _target | contract HATVault | undefined |
| _asset | contract IERC20 | undefined |
| _amount | uint256 | undefined |

### setVaultsAllocPoint

```solidity
function setVaultsAllocPoint(contract HATVault[] _hatVaults, contract IRewardController _rewardController, uint256 _allocPoint) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _hatVaults | contract HATVault[] | undefined |
| _rewardController | contract IRewardController | undefined |
| _allocPoint | uint256 | undefined |




