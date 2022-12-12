
## Parameters
|owner| parameter name  | scope| default | limits  |  setter | comments
|-|-|-|-|-|-|-|
|`registry.owner`|`defaultBountyGovernanceHAT`|global ||+defaultBountyHackerHatVested <= 20% |`registry.setDefaultHATBountySplit`
|`registry.owner`|`bountyGovernanceHAT`|vault ||+bountyHackerHatVested <= 20%|`vault.setHATBountySplit`
|`registry.owner`|`defaultBountyHackerHATVested`|global||+defaultBountyGovernanceHAT <= 20%|`registry.setDefaultHATBountySplit`
|`registry.owner`|`bountyHackerHATVested`|vault ||+bountyGovernanceHAT<=20%|`vault.setHATBountySplit`
|`registry.owner`|`defaultArbitrator`|global|registry.owner| | `registry.setDefaultArbitrator`
|`registry.owner`|`arbitrator`|vault|| |  `vault.setArbitrator`
|`registry.owner`|`defaultChallengePeriod`|global| 3 days | >= 1 days, <= 5 days |  `registry.setDefaultChallengePeriod`
|`registry.owner`|`challengePeriod`|vault|3 days | >= 1 days, <= 5 days |`vault.setChallengePeriod`
|`registry.owner`|`defaultChallengeTimeOutPeriod`|global| 5 weeks | >= 2 days, <= 85 days|  `registry.setDefaultChallengeTimeOutPeriod`
|`registry.owner`|`challengeTimeOutPeriod`|vault| 5 weeks | >= 2 days, <= 85 days|`vault.setChallengeTimeOutPeriod`
|`registry.owner`|`defaultArbitratorCanChangeBounty`|global|true| | `registry.setDefaultArbitratorCanChangeBounty`
|`registry.owner`|`arbitratorCanChangeBounty`|vault|true| |  `vault.setArbitratorCanChangeBounty`
|`registry.owner`|`isVaultVisible`|vault| false ||`registry.setVaultVisibility(_vault, _visible)`
|`registry.owner`|`feeSetter`|global|zero address| |`registry.setFeeSetter`
|`registry.owner`|`withdrawRequestPendingPeriod`|global|7 days | <= 90 days|`registry.setWithdrawRequestParams`
|`registry.owner`|`withdrawRequestEnablePeriod`|global|7 days |>= 6 hours, <= 100 days|`registry.setWithdrawRequestParams`
|`registry.owner`|`claimFee`|global|0 | - |`registry.setClaimFee`|
|`registry.owner`|`withdrawPeriod`|global|11 hours | >= 1 hours |`registry.setWithdrawSafetyPeriod`
|`registry.owner`|`safetyPeriod`|global|1 hours | <= 6 hours|`registry.setWithdrawSafetyPeriod`
|`registry.owner`|`hatVestingDuration`|global|90 days | < 180 days |  `registry.setHatVestingParams`
|`registry.owner`|`hatVestingPeriods`|global| 90 | > 0, <= hatVestingDuration |  `registry.setHatVestingParams`
|`registry.owner`|`setMaxBountyDelay`| global|2 days |>= 2 days|`registry.setMaxBountyDelay`
|`registry.owner`|`rewardController`|vault || | `vault.addRewardController` | noActiveClaim
|`registry.owner`|registry.`owner`| global| _hatGovernance || `registry.transferOwnership`, `registry.renounceOwnership` 
|`registry.owner`|`vaultDescription`|vault || | `vault.setVaultDescription` | only an event
|`registry.owner`|`isEmergencyPaused`|global|false |  |`setEmergencyPaused`| emergency pause will pause deposits and payout, but not  emergency withdrawals
|`feeSetter`|`withdrawalFee`|vault|0| `<= 200` (<= 2%) |`vault.setWithdrawalFee`
|`vault.owner`|`committee`|vault||| `vault.setCommittee` |if committee has not checked in yet
|`vault.owner`|`vestingPeriods`|vault|| > 0|`vault.setVestingParams` 
|`vault.owner`|`vestingDuration`|vault||<= 120 days, > `vestingPeriods`|  `vault.setVestingParams`
|`vault.owner`|`bountySplit.hacker`|vault| | sum(bountySplit) = 100%|`vault.setBountySplit` | noActiveClaim noSafetyPeriod
|`vault.owner`|`bountySplit.hackerVested`|vault| |sum(bountySplit) = 100% |`vault.setBountySplit` |noActiveClaim noSafetyPeriod
|`vault.owner`|`bountySplit.committee`|vault || sum(bountySplit) = 100%, max 10% | `vault.setBountySplit`|noActiveClaim noSafetyPeriod
|`vault.owner`|`maxBounty`|vault || `<= 9000` (<= 90%)|`vault.setPendingMaxBounty`, `vault.setMaxBounty` |noActiveClaim
|`vault.owner`|`depositPause`|vault || |  `vault.setDepositPause`
|`vault.owner`|`owner`|vault|_hatGovernance | |  `vault.transferOwnership`, `vault.renounceOwnership`  
|`vault.committee`|`committee`|vault| || `vault.setCommittee`| after `committeeCheckIn`
|`vault.committee`|`committeeCheckedIn`|vault| || `vault.committeeCheckIn()`
|`rewardController.owner`|vault's `allocPoint` | vault |0|| `rewardController.setAllocPoint(_vault, _allocPoint)`
|`rewardController.owner`|`epochRewardPerBlock`| global ||| `rewardController.setEpochRewardPerBlock`|
|`rewardController.owner`|`rewardController.owner`| global ||| `rewardController.transferOwnership`, `rewardController.renounceOwnership`|


