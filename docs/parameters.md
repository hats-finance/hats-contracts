
## Settings managed by Registry owner
| parameter  | default | limits  | scope | setter | 
|-|-|-|-|-|
|`isEmergencyPaused`|0 | - |global|`setEmergencyPaused`|
|`defaultHATBountySplit.governanceHAT` || |global |`registry.setDefaultHATBountySplit`
|`bountySplit.governanceHAT` || |set per vault|`vault.setHATBountySplit`
|`defaultHATBountySplit.hackerHATVested` || |set per vault|`registry.setDefaultHATBountySplit`
|`bountySplit.hackerHATVested` || |set per vault|`vault.setHATBountySplit`
|`defaultArbitrator`|registry.owner| | global | `registry.setDefaulttArbitrator`
|`abitrator`|registry.owner| | set per vault | `vault.setArbitrator`
|`defaultChallengePeriod`|3 days | >= 1 days, <= 5 days | global | `registry.setDefaultChallengePeriod`
|`challengePeriod`|3 days | >= 1 days, <= 5 days | set per vault | `vault.setChallengePeriod`
|`defaultChallengeTimeOutPeriod`| 5 weeks | >= 2 days, <= 85 days| global | `registry.setDefaultChallengeTimeOutPeriod`
|`challengeTimeOutPeriod`| 5 weeks | >= 2 days, <= 85 days| set per vault | `vault.setChallengeTimeOutPeriod`
|`isVaultVisible`| false ||per vault|`setVaultVisibility(_vault, _visible)`
|`feeSetter`|zero address | |global|`setFeeSetter`
|`withdrawRequestPendingPeriod`| 7 days | <= 90 days|global|`setWithdrawRequestParams`
|`withdrawRequestEnablePeriod`|7 days |>= 6 hours, <= 100 days|global|`setWithdrawRequestParams`
|`claimFee`|0 | - |global|`setClaimFee`|
|`withdrawPeriod`|11 hours | >= 1 hours |global|`setWithdrawSafetyPeriod`
|`safetyPeriod`|1 hours | <= 6 hours | global ||`setWithdrawSafetyPeriod`
|`hatVestingDuration`|90 days | < 180 days | global |  `setHatVestingParams`
|`hatVestingPeriods`| 90 | > 0, <= hatVestingDuration |global|  `setHatVestingParams`
|`setMaxBountyDelay`| 2 days |>= 2 days|global|`setMaxBountyDelay`
|`owner`| _hatGovernance | || `transferOwnership`, `renounceOwnership` 


## Vault settings managed by feeSetter

| parameter  | default | limits  | scope | setter | 
|-|-|-|-|-|
|`withdrawalFee`| 0| `<= 200` (<= 2%) |vault |`vault.setWithdrawalFee`

## Settings managed by Vault owner

| parameter  | default | limits  | setter ||
|-|-|-|-|-|
|`committee`| | | `setComittee` | if committee has not checked in yet
|`vestingPeriods`|| > 0|`setVestingParams` 
|`vestingDuration`| |<= 120 days, `< vestingPeriods`|  `setVestingParams`
|`bountySplit.hacker`| | sum(bountysplit) = 100%|`setBountySplit` 
|`bountySplit.hackerVested`| |sum(bountysplit) = 100% |`setBountySplit` 
|`bountySplit.committee`| | sum(bountysplit) = 100%| `setBountySplit`
|`maxBounty`| | `<= 9000` (<= 90%)|`setPendingMaxBounty`, `setMaxBounty` 
|`vaultDescription`| | | `setVaultDescription` | only an event
|`rewardController`| | | `setRewardController`
|`depositPause`| | |  `setDepositPause`
|`owner`| _hatGovernance | |  `transferOwnership`, `renounceOwnership`  


-  `setCommittee` only if comittee has not checked in yet 
-  `setBountySplit` only if there is no active claim and no safetyperiod, 
- `vestingDuration < vestingPeriods`


## Settings owned by comittee
| parameter  | default | limits  | scope | setter | | 
|-|-|-|-|-|-|
|`committee`  | | | vault | `vault.setComittee`
|`committeeCheckedIn`  | | | vault| `vault.committeeCheckin()`

## RewardController settings (managed by RewardController.owner)
| parameter  | default | limits  | scope | setter | | 
|-|-|-|-|-|-|
|vault's `allocPoint` | 0 | |vault| `setAllocPoint(_vault, _allocPoint)`
|`epochRewardPerBlock`| | - |global | `setEpochRewardPerBlock`|

RewardController params that are not settable:

| parameter  | default | limits  | scope | setter | | 
|-|-|-|-|-|-|
|`startBlock`| | - | global | set in `initialize` | 
|`epochLength`| | - |global | set in `initialize`|
|`rewardToken`| | - |global | set in `initialize`|

## HATs governance is mitigated by a timelock

Setting that can be set immediately (i.e. not subject to timelock):

