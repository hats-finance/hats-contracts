# Security Analysis HATVaults 2.0


The contracts in this repository define a number of different roles that have the power to change the way the contracts work. We list them here, with a short description of what an account with this role can do, and to which account this role will be assigned on deployment

## `HATVaultsRegistry.owner`

- can call `setFeeSetter` set the feeSetter role
- can call `setArbitrator` set the arbitrator role
- can call `setWithdrawRequestParams` set time limits for withdrawal requests
- can call `setClaimFee` set fee for submitting a vulnerability
- can call `setChallengePeriod` to set the time during which a claim can be challenged by the arbitrator
- can call `setChallengeTimeOutPeriod` to set the time after which a challenged claim is automatically dismissed
- can call `setWithdrawSafetyPeriod` set the amount of time during which claims can be submitted; during this time the vault users can not withdraw their funds. Must be less than 6 hours
- can call `setHatVestingParams` set vesting paramaters for bounty paid in hats
- can call `setMaxBountyDelay` to set the timelock delay for setting the max bounty
- can call `setRouterWhitelistStatus` add or remove address from the whitelist of routers that can be used for token swapping
- can call `swapBurnSend` and swap, burn, and send the vauit's token that are earmarked for payout (after approveClaim)

## `HatVault.owner`

The `owner` of a hatvault created by the registry is the same registry owner.

- can call `transferOwnership` and `renounceOwnership` of `HATVaults`
- can call `updateVaultInfo` to change some of the vault's properties (description, if it is paused for deposit, visibility in the app) [SUBJECT TO CHANGE]
- can call `setVestingParams` set vesting parameters for bounty paid in vault's token
- can call `setBountySplit` set how the bounty is split between security researcher, committee and governance
- can call `setCommittee` but only if the committee has not checked in yet
- can call `setRewardController`  and set the reward controller

## `HATVault.committee` (committee of each vault, set on creation)

- a specific address for each vault, typically a multisig
- can call `committeeCheckIn`  to claim it's role - only after the committee has checked in, deposits to the vault are enabled
- can call `setCommittee` - set new committee address. Can be called by existing committee if it had checked in, or by the governance otherwise.
- can call `submitClaim` - submit a claim for a bounty payout
- `setPendingMaxBounty` - set a pending request for the maximum percentage of the vault that can be paid out as a bounty.
- `setMaxBounty` - set the vault's max bounty to the already pending max bounty, after the time delay (of HATVaultsRegistry.GeneralParameters.setMaxBountyDelay) had passed.

## `HATVaultsRegistry.arbitrator`
- can call `challengeClaim` to challenge a claim for a bounty payout that was previously submitted by a vault's committee
- can call `approveClaim` to approve a claim for a bounty payout that was previously challenged and change the bounty percentage (in case the claim was not challenged and the challengePeriod had ended - anyone can approve the claim without changing the bounty percentage)
- can call `dismissClaim` to dismiss a claim for a bounty payout that was previously challenged (in case the claim was challenged and the challengeTimeOutPeriod had ended - anyone can dismiss the claim)
(see [arbitrator](./arbitrator.md))

## `HATVaultsRegistry.feeSetter`

- set to `HATTimeLockController`
- can call `setWithdrawalFee` (set the fee for withdrawals from the vault)

## `RewardController.owner`

- set to HATS governance (not timelocked)
- can call `setRewardPerEpoch`
- can call `setAllocPoints`

## `RewardController - proxy.owner`

- set to `HATTimelockController`
- can upgrade the reward controller

## `HATTimelockController.TIMELOCK_ADMIN_ROLE`

- set to governance multisig
- can manage all other roles (subject to timelock)

## `HATTimelockController.PROPOSER_ROLE`

- set to governance multisig
- can call `schedule` and `scheduleBatch` to schedule any contract call

## `HATTimelockController.EXECUTOR_ROLE`

- set to "anyone"
- can call `execute` and `executeBatch` to execute a scheduled operation

## `HATTimelockController.CANCELLER_ROLE`

- set to governance multisig
- can call `cancel` and cancel any pending operation


## The following functions in HATVaults are **not** subject to a timelock:
  - `approveClaim`
  - `setPool`
  - `updateVaultInfo`
  - `setAllocPoint`

