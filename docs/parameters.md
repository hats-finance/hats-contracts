
## Settings managed by Registry owner
| parameter  | scope| default | limits  |  setter | 
|-|-|-|-|-|
|`isEmergencyPaused`|global|0 | - |`setEmergencyPaused`|
|`defaultHATBountySplit.governanceHAT`|global ||  |`registry.setDefaultHATBountySplit`
|`bountySplit.governanceHAT`|vault || |`vault.setHATBountySplit`
|`defaultHATBountySplit.hackerHATVested`|global|| |`registry.setDefaultHATBountySplit`
|`bountySplit.hackerHATVested`|vault || |`vault.setHATBountySplit`
|`defaultArbitrator`|global|registry.owner| | `registry.setDefaultArbitrator`
|`abitrator`|vault|| |  `vault.setArbitrator`
|`defaultChallengePeriod`|global| 3 days | >= 1 days, <= 5 days |  `registry.setDefaultChallengePeriod`
|`challengePeriod`|vault|3 days | >= 1 days, <= 5 days |`vault.setChallengePeriod`
|`defaultChallengeTimeOutPeriod`|global| 5 weeks | >= 2 days, <= 85 days|  `registry.setDefaultChallengeTimeOutPeriod`
|`challengeTimeOutPeriod`|vault| 5 weeks | >= 2 days, <= 85 days|`vault.setChallengeTimeOutPeriod`
|`isVaultVisible`|vault| false ||`setVaultVisibility(_vault, _visible)`
|`feeSetter`|global|zero address| |`setFeeSetter`
|`withdrawRequestPendingPeriod`|global|7 days | <= 90 days|`setWithdrawRequestParams`
|`withdrawRequestEnablePeriod`|global|7 days |>= 6 hours, <= 100 days|`setWithdrawRequestParams`
|`claimFee`|global|0 | - |`setClaimFee`|
|`withdrawPeriod`|global|11 hours | >= 1 hours |`setWithdrawSafetyPeriod`
|`safetyPeriod`|global|1 hours | <= 6 hours|`setWithdrawSafetyPeriod`
|`hatVestingDuration`|global|90 days | < 180 days |  `setHatVestingParams`
|`hatVestingPeriods`|global| 90 | > 0, <= hatVestingDuration |  `setHatVestingParams`
|`setMaxBountyDelay`| global|2 days |>= 2 days|`setMaxBountyDelay`
|registry.`owner`| global| _hatGovernance | || `transferOwnership`, `renounceOwnership` 


## Vault settings managed by feeSetter

| parameter|scope|default|limits|setter| 
|-|-|-|-|-|
|`withdrawalFee`|vault|0| `<= 200` (<= 2%) |vault.setWithdrawalFee`

## Settings managed by Vault owner

|parameter|scope|default|limits|setter| 
|-|-|-|-|-|
|`committee`|vault|| | `setComittee` | if committee has not checked in yet
|`vestingPeriods`|vault|| > 0|`setVestingParams` 
|`vestingDuration`|vault||<= 120 days, `< vestingPeriods`|  `setVestingParams`
|`bountySplit.hacker`|vault| | sum(bountysplit) = 100%|`setBountySplit` 
|`bountySplit.hackerVested`|vault| |sum(bountysplit) = 100% |`setBountySplit` 
|`bountySplit.committee`|vault || sum(bountysplit) = 100%| `setBountySplit`
|`maxBounty`|vault || `<= 9000` (<= 90%)|`setPendingMaxBounty`, `setMaxBounty` 
|`vaultDescription`|vault || | `setVaultDescription` | only an event
|`rewardController`|vault || | `setRewardController`
|`depositPause`|vault || |  `setDepositPause`
|`owner`|vault|_hatGovernance | |  `transferOwnership`, `renounceOwnership`  


-  `setCommittee` only if comittee has not checked in yet 
-  `setBountySplit` only if there is no active claim and no safetyperiod, 


## Settings managed by vault's Comittee
|parameter|scope|default|limits|setter| 
|-|-|-|-|-|
|`committee`|vault| || `vault.setComittee`
|`committeeCheckedIn`|vault| || `vault.committeeCheckin()`

## RewardController settings (managed by RewardController.owner)
|parameter|scope|default|limits|setter| 
|-|-|-|-|-|
|vault's `allocPoint` | 0 | |vault| `setAllocPoint(_vault, _allocPoint)`
|`epochRewardPerBlock`| | - |global | `setEpochRewardPerBlock`|

RewardController params that are not settable:

|parameter|scope|default|limits|setter| 
|-|-|-|-|-|
|`startBlock`|global | - | | set in `initialize` | 
|`epochLength`|global | - || set in `initialize`|
|`rewardToken`|global | - || set in `initialize`|

## HATs governance is mitigated by a timelock

The owner of the registry, and typically the owner of the vault as well, is controlled by an instance of `HATTimelockController`. This means that some function calls can not be executed immediately, but go through a time lock period.


