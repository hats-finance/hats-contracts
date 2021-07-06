


## Functions
### constructor
```solidity
  function constructor(
  ) public
```




### massUpdatePools
```solidity
  function massUpdatePools(
    uint256 _fromPid,
    uint256 _toPid
  ) external
```

massUpdatePools - Update reward vairables for all pools
Be careful of gas spending!

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_fromPid` | uint256 | update pools range from this pool id
|`_toPid` | uint256 | update pools range to this pool id

### claimReward
```solidity
  function claimReward(
  ) external
```




### updatePool
```solidity
  function updatePool(
  ) public
```




### getMultiplier
```solidity
  function getMultiplier(
    uint256 _from,
    uint256 _to
  ) public returns (uint256 result)
```

getMultiplier - multiply blocks with relevant multiplier for specific range

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_from` | uint256 | range's from block
|`_to` | uint256 | range's to block
will revert if from < START_BLOCK or _to < _from

### getRewardForBlocksRange
```solidity
  function getRewardForBlocksRange(
  ) public returns (uint256)
```




### calcPoolReward
```solidity
  function calcPoolReward(
    uint256 _pid,
    uint256 _from,
    uint256 _lastPoolUpdate
  ) public returns (uint256 reward)
```

calcPoolReward -
calculate rewards for a pool by iterate over the history of totalAllocPoints updates.
and sum up all rewards periods from pool.lastRewardBlock till current block number.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_pid` | uint256 | pool id
|`_from` | uint256 | block starting calculation
|`_lastPoolUpdate` | uint256 | lastPoolUpdate (globalUpdates length)


### _deposit
```solidity
  function _deposit(
  ) internal
```




### _withdraw
```solidity
  function _withdraw(
  ) internal
```




### _emergencyWithdraw
```solidity
  function _emergencyWithdraw(
  ) internal
```




### add
```solidity
  function add(
  ) internal
```




### set
```solidity
  function set(
  ) internal
```




### safeTransferReward
```solidity
  function safeTransferReward(
  ) internal
```




## Events
### Deposit
```solidity
  event Deposit(
  )
```



### Withdraw
```solidity
  event Withdraw(
  )
```



### EmergencyWithdraw
```solidity
  event EmergencyWithdraw(
  )
```



### SendReward
```solidity
  event SendReward(
  )
```



### MassUpdatePools
```solidity
  event MassUpdatePools(
  )
```



