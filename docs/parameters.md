
## Settings owned by registry owner
| parameter  | default | limits  | applies to | | 
|-|-|-|-|-|
|`claimFee`|0 | - |global|`setClaimFee`|
|`feeSetter`|zero address | |global|`setFeeSetter`
|`hatVestingDuration`|90 days | < 180 days | global |  `setHatVestingParams`
|`hatVestingPeriods`| 90 | > 0, <= hatVestingDuration |global|  `setHatVestingParams`
|`withdrawPeriod`|11 hours | >= 1 hours |global|`setWithdrawSafetyPeriod`
|`safetyPeriod`|1 hours | <= 6 hours | global ||`setWithdrawSafetyPeriod`
|`withdrawRequestPendingPeriod`| 7 days | <= 90 days|global|`setWithdrawRequestParams`
|`withdrawRequestEnablePeriod`|7 days |>= 6 hours, <= 100 days|global||`setWithdrawRequestParams`
|`setMaxBountyDelay`| 2 days |>= 2 days|global|`setMaxBountyDelay`
|`isVaultVisible`| false ||per vault|`setVaultVisibility`
|`owner`| _hatGovernance | || `transferOwnership`, `renounceOwnership` 
|`arbitrator`|registry.owner| | set per vault | `vault.setArbitrator`
|`challengePeriod`|3 days | >= 1 days, <= 5 days | set per vault | `vault.setChallengePeriod`
|`challengeTimeOutPeriod`| 5 weeks | >= 2 days, <= 85 days| set per vault | `vault.setChallengeTimeOutPeriod`
|`bountyGovernanceHAT` || 99.99% combined with bountyHackerHATVested |set per vault|`vault.setBountyGovernanceHAT`
|`bountyHackerHATVested` || 99.99% combined with bountyGovernanceHAT |set per vault|`vault.setBountyHackerHATVested`


- `bountyGovernanceHAT + bountyHackerHATVested <= 100%`
- `hatVestingDuration < hatVestingPeriods`

## Settings owned by feeSetter

| parameter  | default | limits  | | | 
|-|-|-|-|-|
|`withdrawalFee`| 0| `<= 200` (<= 2%) |set per vault |`vault.setWithdrawalFee`

## Settings owned by Vault owner

| parameter  | default | limits  | | |
|-|-|-|-|-|
|`vaultDescription`| | | `setVaultDescription`
|`depositPause`| | |  `setDepositPause`
|`bountySplit.hacker`| | sum(bountysplit) = 100%|`setBountySplit` 
|`bountySplit.hackerVested`| |sum(bountysplit) = 100% |`setBountySplit` 
|`bountySplit.committee`| | sum(bountysplit) = 100%| `setBountySplit`
|`rewardController`| | | `setRewardController`
|`vestingDuration`| |<= 120 days, `< vestingPeriods`|  `setVestingParams`
|`vestingPeriods`|| > 0|`setVestingParams` 
|`maxBounty`| | `<= 9000` (<= 90%)|`setPendingMaxBounty`, `setMaxBounty` 
|`committee`| | | `setComittee` | if committee has not checked in yet
|`owner`| _hatGovernance | |  `transferOwnership`, `renounceOwnership`  


-  `setCommittee` only if comittee has not checked in yet 
-  `setBountySplit` only if there is no active claim and no safetyperiod, 
- `vestingDuration < vestingPeriods`


## Settings owned by comittee
| parameter  | default | limits  | | 
|-|-|-|-|
|committee  | | | `vault.setComittee`


## HATs governance is mitigated by a timelock

Setting that can be set immediately (i.e. not subject to timelock):

