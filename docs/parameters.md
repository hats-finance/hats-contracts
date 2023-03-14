## Parameters

 | parameter name | owner| scope | default | limits | setter | comments |
|---|---|---|---|---|---|---|
| `HAT` | `registry.owner` | global | - | `registry.setSwapToken` | the token for which bounties for HAts will be traded
| `isEmergencyPaused` | `registry.owner`| global | false | | `setEmergencyPaused` |
| `defaultBountyGovernanceHAT` | `registry.owner`| global | | +defaultBountyHackerHatVested <= 20% | `registry.setDefaultHATBountySplit` |
| `bountyGovernanceHAT` | `registry.owner`| vault | | +bountyHackerHatVested <= 20% | `vault.setHATBountySplit` |
| `defaultBountyHackerHATVested` | `registry.owner`| global | | +defaultBountyGovernanceHAT <= 20% | `registry.setDefaultHATBountySplit` |
| `bountyHackerHATVested`| `registry.owner` | vault | | +bountyGovernanceHAT <= 20% | `vault.setHATBountySplit` |
| `defaultArbitrator` | `registry.owner` | global | registry.owner | | `registry.setDefaultArbitrator` |
| `arbitrator` | `registry.owner`| vault | | |  `vault.setArbitrator` |
| `defaultChallengePeriod` | `registry.owner`| global | 3 days | >= 1 days, <= 5 days |  `registry.setDefaultChallengePeriod` |
| `challengePeriod` | `registry.owner`| vault | 3 days | >= 1 days, <= 5 days | `vault.setChallengePeriod` |
| `defaultChallengeTimeOutPeriod` | `registry.owner`| global | 5 weeks | >= 2 days, <= 85 days |  `registry.setDefaultChallengeTimeOutPeriod` |
| `challengeTimeOutPeriod` | `registry.owner`| vault | 5 weeks | >= 2 days, <= 85 days | `vault.setChallengeTimeOutPeriod` |
| `defaultArbitratorCanChangeBounty` | `registry.owner`| global | true | | `registry.setDefaultArbitratorCanChangeBounty` |
| `arbitratorCanChangeBounty` | `registry.owner`| vault | true | |  `vault.setArbitratorCanChangeBounty` |
| `isVaultVisible` | `registry.owner`| vault | false | | `registry.setVaultVisibility(_vault, _visible)` |
| `feeSetter` | `registry.owner`| global |zero address | | `registry.setFeeSetter` |
| `withdrawRequestPendingPeriod` | `registry.owner`| global | 7 days | <= 90 days | `registry.setWithdrawRequestParams` |
| `withdrawRequestEnablePeriod` | `registry.owner`| global | 7 days | >= 6 hours, <= 100 days | `registry.setWithdrawRequestParams` |
| `claimFee` | `registry.owner`| global | 0 | - | `registry.setClaimFee` |
| `withdrawPeriod` | `registry.owner`| global | 11 hours | >= 1 hours | `registry.setWithdrawSafetyPeriod` |
| `safetyPeriod` | `registry.owner`| global | 1 hours | <= 6 hours | `registry.setWithdrawSafetyPeriod` |
| `hatVestingDuration` | `registry.owner`| global | 90 days | < 180 days |  `registry.setHatVestingParams` |
| `hatVestingPeriods` | `registry.owner`| global | 90 | > 0, <= hatVestingDuration |  `registry.setHatVestingParams` |
| `setMaxBountyDelay` | `registry.owner`| global | 2 days | >= 2 days | `registry.setMaxBountyDelay` |
| `rewardController` | `registry.owner`| vault | | | `vault.addRewardController` | noActiveClaim |
|registry.`owner` | `registry.owner`| global | _hatGovernance | | `registry.transferOwnership`, `registry.renounceOwnership` |
| `vaultDescription` | `registry.owner`| vault | | | `vault.setVaultDescription` | only an event |
| `feeSetter` | `withdrawalFee`| `feeSetter` | vault | 0 | <= 2% | `vault.setWithdrawalFee` |
| `committee` | | `vault.owner` vault | | | `vault.setCommittee` | if committee has not checked in yet |
| `vestingPeriods` | `vault.owner` | vault | | > 0 | `vault.setVestingParams` |
| `vestingDuration` | `vault.owner` | vault | | <= 120 days, > `vestingPeriods` | `vault.setVestingParams` |
| `bountySplit.hacker` | `vault.owner` | vault | | sum(bountySplit) = 100% | `vault.setBountySplit` | noActiveClaim noSafetyPeriod |
| `bountySplit.hackerVested` | `vault.owner` | vault | | sum(bountySplit) = 100% | `vault.setBountySplit` | noActiveClaim noSafetyPeriod |
| `bountySplit.committee` | `vault.owner` | vault | | sum(bountySplit) = 100%, max 10% | `vault.setBountySplit` | noActiveClaim noSafetyPeriod |
| `maxBounty` | `vault.owner` | vault | | <= 90% | `vault.setPendingMaxBounty`, `vault.setMaxBounty` | noActiveClaim |
| `depositPause` | `vault.owner` | vault | | | `vault.setDepositPause` |
| `owner` | `vault.owner` | vault | _hatGovernance | |  `vault.transferOwnership`, `vault.renounceOwnership` |
| `committee` | `vault.committee` | vault | | | `vault.setCommittee` | after `committeeCheckIn` |
| `committeeCheckedIn` | `vault.committee` | vault | | | `vault.committeeCheckIn()` |
| vault's `allocPoint` | `rewardController.owner` | vault | 0 | | `rewardController.setAllocPoint(_vault, _allocPoint)` |
| `epochRewardPerBlock` | `rewardController.owner` | global | | | `rewardController.setEpochRewardPerBlock` |
| `rewardController.owner` | `rewardController.owner` | global | | | `rewardController.transferOwnership`, `rewardController.renounceOwnership` |

