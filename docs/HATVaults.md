


## Functions
### constructor
```solidity
  function constructor(
    address _rewardsToken,
    uint256 _rewardPerBlock,
    uint256 _startBlock,
    uint256 _halvingAfterBlock,
    address _hatGovernance,
    contract ISwapRouter _uniSwapRouter,
    contract ITokenLockFactory _tokenLockFactory
  ) public
```

constructor -

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_rewardsToken` | address | the reward token address (HAT)
|`_rewardPerBlock` | uint256 | the reward amount per block the contract will reward pools
|`_startBlock` | uint256 | start block of of which the contract will start rewarding from.
|`_halvingAfterBlock` | uint256 | a fix period value. each period will have its own multiplier value.
       which set the reward for each period. e.g a vaule of 100000 means that each such period is 100000 blocks.
|`_hatGovernance` | address | the governance address.
       Some of the contracts functions are limited only to governance :
        addPool,setPool,dismissPendingApprovalClaim,approveClaim,
        setHatVestingParams,setVestingParams,setRewardsSplit
|`_uniSwapRouter` | contract ISwapRouter | uni swap v3 router to be used to swap tokens for HAT token.
|`_tokenLockFactory` | contract ITokenLockFactory | address of the token lock factory to be used
       to create a vesting contract for the approved claim reporter.

### pendingApprovalClaim
```solidity
  function pendingApprovalClaim(
    uint256 _pid,
    address _beneficiary,
    uint256 _severity
  ) external
```

pendingApprovalClaim - called by a commitee to set a pending approval claim.
The pending approval need to be approved or dismissd  by the hats governance.
This function should be called only on a safty period, where withdrawn is disable.
Upon a call to this function by the committee the pool withdrawn will be disable
till governance will approve or dismiss this pending approval.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_pid` | uint256 | pool id
|`_beneficiary` | address | the approval claim beneficiary
|`_severity` | uint256 | approval claim severity

### setWithdrawRequestParams
```solidity
  function setWithdrawRequestParams(
    uint256 _withdrawRequestPendingPeriod,
    uint256 _withdrawRequestEnablePeriod
  ) external
```

setWithdrawRequestParams - called by hats governance to set withdraw request params

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_withdrawRequestPendingPeriod` | uint256 | - the time period where the withdraw request is pending.
|`_withdrawRequestEnablePeriod` | uint256 | - the time period where the withdraw is enable for a withdraw request.

### dismissPendingApprovalClaim
```solidity
  function dismissPendingApprovalClaim(
    uint256 _poolId
  ) external
```

dismissPendingApprovalClaim - called by hats governance to dismiss a pending approval claim.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_poolId` | uint256 | pool id

### approveClaim
```solidity
  function approveClaim(
    uint256 _poolId
  ) external
```

approveClaim - called by hats governance to approve a pending approval claim.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_poolId` | uint256 | pool id

### setClaimFee
```solidity
  function setClaimFee(
    uint256 _fee
  ) external
```

setClaimFee - called by hats governance to set claim fee

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_fee` | uint256 | claim fee in ETH

### setWithdrawSafetyPeriod
```solidity
  function setWithdrawSafetyPeriod(
    uint256 _withdrawPeriod,
    uint256 _safetyPeriod
  ) external
```

setWithdrawSafetyPeriod - called by hats governance to set Withdraw Period

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_withdrawPeriod` | uint256 | withdraw enable period
|`_safetyPeriod` | uint256 | withdraw disable period

### claim
```solidity
  function claim(
  ) external
```




### setVestingParams
```solidity
  function setVestingParams(
    uint256 _pid,
    uint256 _duration,
    uint256 _periods
  ) external
```

setVestingParams - set pool vesting params for rewarding claim reporter with the pool token

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_pid` | uint256 | pool id
|`_duration` | uint256 | duration of the vesting period
|`_periods` | uint256 | the vesting periods

### setHatVestingParams
```solidity
  function setHatVestingParams(
    uint256 _duration,
    uint256 _periods
  ) external
```

setHatVestingParams - set HAT vesting params for rewarding claim reporter with HAT token
the function can be called only by governance.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_duration` | uint256 | duration of the vesting period
|`_periods` | uint256 | the vesting periods

### setRewardsSplit
```solidity
  function setRewardsSplit(
    uint256 _pid,
    struct HATMaster.RewardsSplit _rewardsSplit
  ) external
```

setRewardsSplit - set the pool token rewards split upon an approval
the function can be called only by governance.
the sum of the rewards split should be less than 10000 (less than 100%)

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_pid` | uint256 | pool id
|`_rewardsSplit` | struct HATMaster.RewardsSplit | split
and sent to the hacker(claim reported)

### setRewardsLevelsDelay
```solidity
  function setRewardsLevelsDelay(
  ) external
```




### setPendingRewardsLevels
```solidity
  function setPendingRewardsLevels(
    uint256 _pid,
    uint256[] _rewardsLevels
  ) external
```

setPendingRewardsLevels - set pending request to set pool token rewards level.
the reward level represent the percentage of the pool's token which will be splited as a reward.
the function can be called only by the pool committee.
cannot be called if there already pending approval.
each level should be less than 10000

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_pid` | uint256 | pool id
|`_rewardsLevels` | uint256[] | the reward levels array

### setRewardsLevels
```solidity
  function setRewardsLevels(
    uint256 _pid
  ) external
```

setRewardsLevels - set the pool token rewards level of already pending set rewards level.
see pendingRewardsLevels
the reward level represent the percentage of the pool's token which will be splited as a reward.
the function can be called only by the pool committee.
cannot be called if there already pending approval.
each level should be less than 10000

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_pid` | uint256 | pool id

### committeeCheckIn
```solidity
  function committeeCheckIn(
    uint256 _pid
  ) external
```

committeeCheckIn - committee check in.
deposit is enable only after committee check in

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_pid` | uint256 | pool id

### setCommittee
```solidity
  function setCommittee(
  ) external
```




### addPool
```solidity
  function addPool(
    uint256 _allocPoint,
    address _lpToken,
    address _committee,
    uint256[] _rewardsLevels,
    struct HATMaster.RewardsSplit _rewardsSplit,
    string _committee,
    uint256[2] _descriptionHash,
     _rewardVestingParams
  ) external
```

addPool - onlyGovernance

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_allocPoint` | uint256 | the pool allocation point
|`_lpToken` | address | pool token
|`_committee` | address | pools committee addresses array
|`_rewardsLevels` | uint256[] | pool reward levels(sevirities)
     each level is a number between 0 and 10000.
|`_rewardsSplit` | struct HATMaster.RewardsSplit | pool reward split.
     each entry is a number between 0 and 10000.
     total splits should be less than 10000
|`_committee` | string | pools committee addresses array
|`_descriptionHash` | uint256[2] | the hash of the pool description.
|`_rewardVestingParams` |  | vesting params
       _rewardVestingParams[0] - vesting duration
       _rewardVestingParams[1] - vesting periods

### setPool
```solidity
  function setPool(
    uint256 _pid,
    uint256 _allocPoint,
    bool _registered,
    string _descriptionHash
  ) external
```

setPool

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_pid` | uint256 | the pool id
|`_allocPoint` | uint256 | the pool allocation point
|`_registered` | bool | does this pool is registered (default true).
This parameter can be used by the UI to include or exclude the pool
|`_descriptionHash` | string | the hash of the pool description.

### swapBurnSend
```solidity
  function swapBurnSend(
    uint256 _pid,
    address _beneficiary,
    uint256 _minOutputAmount,
    uint24 _fee,
    uint160 _sqrtPriceLimitX96
  ) external
```
swapBurnSend swap lptoken to HAT.
send to beneficiary and governance its hats rewards .
burn the rest of HAT.
only governance are authorized to call this function.


#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_pid` | uint256 | the pool id
|`_beneficiary` | address | beneficiary
|`_minOutputAmount` | uint256 | minimum output of HATs at swap
|`_fee` | uint24 | the fee of the token pool for the pair
|`_sqrtPriceLimitX96` | uint160 | the price limit of the pool that cannot be exceeded by the swap


### withdrawRequest
```solidity
  function withdrawRequest(
  ) external
```




### deposit
```solidity
  function deposit(
  ) external
```




### withdraw
```solidity
  function withdraw(
  ) external
```




### emergencyWithdraw
```solidity
  function emergencyWithdraw(
  ) external
```




### getPoolRewardsLevels
```solidity
  function getPoolRewardsLevels(
  ) external returns (uint256[])
```




### getPoolRewardsPendingLpToken
```solidity
  function getPoolRewardsPendingLpToken(
  ) external returns (uint256)
```




### getPoolRewards
```solidity
  function getPoolRewards(
  ) external returns (struct HATMaster.PoolReward)
```




### getRewardPerBlock
```solidity
  function getRewardPerBlock(
  ) external returns (uint256)
```




### pendingReward
```solidity
  function pendingReward(
  ) external returns (uint256)
```




### getGlobalPoolUpdatesLength
```solidity
  function getGlobalPoolUpdatesLength(
  ) external returns (uint256)
```




### getStakedAmount
```solidity
  function getStakedAmount(
  ) external returns (uint256)
```




### poolLength
```solidity
  function poolLength(
  ) external returns (uint256)
```




### calcClaimRewards
```solidity
  function calcClaimRewards(
  ) public returns (struct HATVaults.ClaimReward claimRewards)
```




### getDefaultRewardsSplit
```solidity
  function getDefaultRewardsSplit(
  ) public returns (struct HATMaster.RewardsSplit)
```




### validateSplit
```solidity
  function validateSplit(
  ) internal
```




### checkWithdrawRequest
```solidity
  function checkWithdrawRequest(
  ) internal
```




### swapTokenForHAT
```solidity
  function swapTokenForHAT(
  ) internal returns (uint256 hatsReceived)
```




## Events
### SetCommittee
```solidity
  event SetCommittee(
  )
```



### AddPool
```solidity
  event AddPool(
  )
```



### SetPool
```solidity
  event SetPool(
  )
```



### Claim
```solidity
  event Claim(
  )
```



### SetRewardsSplit
```solidity
  event SetRewardsSplit(
  )
```



### SetRewardsLevels
```solidity
  event SetRewardsLevels(
  )
```



### PendingRewardsLevelsLog
```solidity
  event PendingRewardsLevelsLog(
  )
```



### SwapAndSend
```solidity
  event SwapAndSend(
  )
```



### SwapAndBurn
```solidity
  event SwapAndBurn(
  )
```



### SetVestingParams
```solidity
  event SetVestingParams(
  )
```



### SetHatVestingParams
```solidity
  event SetHatVestingParams(
  )
```



### ClaimApprove
```solidity
  event ClaimApprove(
  )
```



### PendingApprovalLog
```solidity
  event PendingApprovalLog(
  )
```



### WithdrawRequest
```solidity
  event WithdrawRequest(
  )
```



### SetWithdrawSafetyPeriod
```solidity
  event SetWithdrawSafetyPeriod(
  )
```



