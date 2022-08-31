
## Settings managed by Registry owner
|owner| parameter  | scope| default | limits  |  setter | 
|-|-|-|-|-|-|
|`registry.owner`|`isEmergencyPaused`|global|0 | - |`setEmergencyPaused`|
|`registry.owner`|`defaultBountyGovernanceHAT`|global |+defaultBountyHackerHatVested <= 20%|  |`registry.setDefaultHATBountySplit`
|`registry.owner`|`bountyGovernanceHAT`|vault |+bountyHackerHatVested <= 20%| |`vault.setHATBountySplit`
|`registry.owner`|`defaultBountyhackerHATVested`|global|+defaultBountyGovernanceHAT <= 20%| |`registry.setDefaultHATBountySplit`
|`registry.owner`|`bountyHackerHATVested`|vault |+bountyGovernanceHAT<=20%| |`vault.setHATBountySplit`
|`registry.owner`|`defaultArbitrator`|global|registry.owner| | `registry.setDefaultArbitrator`
|`registry.owner`|`arbitrator`|vault|| |  `vault.setArbitrator`
|`registry.owner`|`defaultChallengePeriod`|global| 3 days | >= 1 days, <= 5 days |  `registry.setDefaultChallengePeriod`
|`registry.owner`|`challengePeriod`|vault|3 days | >= 1 days, <= 5 days |`vault.setChallengePeriod`
|`registry.owner`|`defaultChallengeTimeOutPeriod`|global| 5 weeks | >= 2 days, <= 85 days|  `registry.setDefaultChallengeTimeOutPeriod`
|`registry.owner`|`challengeTimeOutPeriod`|vault| 5 weeks | >= 2 days, <= 85 days|`vault.setChallengeTimeOutPeriod`
|`registry.owner`|`defaultArbitratorCanChangeBounty`|global|true| | `registry.setDefaultArbitratorCanChangeBounty`
|`registry.owner`|`arbitratorCanChangeBounty`|vault|| |  `vault.setArbitratorCanChangeBounty`
|`registry.owner`|`isVaultVisible`|vault| false ||`setVaultVisibility(_vault, _visible)`
|`registry.owner`|`feeSetter`|global|zero address| |`setFeeSetter`
|`registry.owner`|`withdrawRequestPendingPeriod`|global|7 days | <= 90 days|`setWithdrawRequestParams`
|`registry.owner`|`withdrawRequestEnablePeriod`|global|7 days |>= 6 hours, <= 100 days|`setWithdrawRequestParams`
|`registry.owner`|`claimFee`|global|0 | - |`setClaimFee`|
|`registry.owner`|`withdrawPeriod`|global|11 hours | >= 1 hours |`setWithdrawSafetyPeriod`
|`registry.owner`|`safetyPeriod`|global|1 hours | <= 6 hours|`setWithdrawSafetyPeriod`
|`registry.owner`|`hatVestingDuration`|global|90 days | < 180 days |  `setHatVestingParams`
|`registry.owner`|`hatVestingPeriods`|global| 90 | > 0, <= hatVestingDuration |  `setHatVestingParams`
|`registry.owner`|`setMaxBountyDelay`| global|2 days |>= 2 days|`setMaxBountyDelay`
|`registry.owner`|registry.`owner`| global| _hatGovernance | || `transferOwnership`, `renounceOwnership` 
|`feeSetter`|`withdrawalFee`|vault|0| `<= 200` (<= 2%) |vault.setWithdrawalFee`
|`vault.owner`|`committee`|vault|| | `setComittee` | if committee has not checked in yet
|`vault.owner`|`vestingPeriods`|vault|| > 0|`setVestingParams` 
|`vault.owner`|`vestingDuration`|vault||<= 120 days, `< vestingPeriods`|  `setVestingParams`
|`vault.owner`|`bountySplit.hacker`|vault| | sum(bountysplit) = 100%|`setBountySplit` 
|`vault.owner`|`bountySplit.hackerVested`|vault| |sum(bountysplit) = 100% |`setBountySplit` 
|`vault.owner`|`bountySplit.committee`|vault || sum(bountysplit) = 100%, max 10% | `setBountySplit`
|`vault.owner`|`maxBounty`|vault || `<= 9000` (<= 90%)|`setPendingMaxBounty`, `setMaxBounty` 
|`vault.owner`|`vaultDescription`|vault || | `setVaultDescription` | only an event
|`vault.owner`|`rewardController`|vault || | `setRewardController`
|`vault.owner`|`depositPause`|vault || |  `setDepositPause`
|`vault.owner`|`owner`|vault|_hatGovernance | |  `transferOwnership`, `renounceOwnership`  
|`vault.committee`|`committee`|vault| || `vault.setComittee`
|`vault.committee`|`committeeCheckedIn`|vault| || `vault.committeeCheckin()`
|`rewardController.ownwer`|vault's `allocPoint` | 0 | |vault| `setAllocPoint(_vault, _allocPoint)`
|`rewardController.ownwer`|`epochRewardPerBlock`| | - |global | `setEpochRewardPerBlock`|


