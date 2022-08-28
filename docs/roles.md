# Security Analysis HATVaults 2.0


The contracts in this repository define a number of different roles that have the power to change the way the contracts work. We list them here, with a short description of what an account with this role can do, and to which account this role will be assigned on deployment

## `HATVaultsRegistry.owner`

- `swapAndSend` and swap and send the vauit's token that are earmarked for payout (after approveClaim)

The owner controls the following settings. 
See [parameters](./parameters.md) for more info.

- `claimFee` fee for submitting a vulnerability
- `feeSetter` the feeSetter role
- `hatVestingParams` vesting parameters for bounty paid in HAT token
- `withdrawSafetyPeriod` the amount of time during which claims can be submitted; during this time the vault users can not withdraw their funds. Must be less than 6 hours
- `withdrawRequestParams` time limits for withdrawal requests
- `maxBountyDelay` the timelock delay for setting the max bounty
- `isVaultVisibile` is the vault's visibility in the UI
- `HATBountySplit` how the HAT bounty is split betwen security researcher and governance
- `owner` - the ownership itself 
- `arbitrator` the arbitrator role
- `challengePeriod` the time during which a claim can be challenged by the arbitrator
- `challengeTimeOutPeriod` the time after which a challenged claim is automatically dismissed



## `HATVaultsRegistry.arbitrator`

- `challengeClaim` to challenge a claim for a bounty payout that was previously submitted by a vault's committee
- `approveClaim` to approve a claim for a bounty payout that was previously challenged and change the bounty percentage (in case the claim was not challenged and the challengePeriod had ended - anyone can approve the claim without changing the bounty percentage)
- `dismissClaim` to dismiss a claim for a bounty payout that was previously challenged (in case the claim was challenged and the challengeTimeOutPeriod had ended - anyone can dismiss the claim)
(see [arbitrator](./arbitrator.md))

## `HATVaultsRegistry.feeSetter`

- set to `HATTimeLockController`
- `setWithdrawalFee` - set the fee for withdrawals from the vault

## `HATVault.owner`

The `owner` of a HATVault.
See [parameters](./parameters.md) for more info.

- `transferOwnership` and `renounceOwnership` of `HATVaults`
- `createVault` to create a new vault
- `approveClaim` to approve a claim for a bounty payout that was previously submitted by a vault's committee

And the following settings:

- `vaultDescription` to change the vault's description hash (only emitted as an event, not stored on-chain)
- `depositPause` to pause and unpause deposits to the vault
- `bountySplit` set how the bounty is split betwen security researcher and committee
- `vestingParams` set vesting parameters for bounty paid in vault's native token
- `maxBounty` (subject to timelock)
- `setRewardController`  and set the reward controller
- `setCommittee` but only if the committee has not checked in yet
- `vault.owner`

## `HATVault.committee` (committee of each vault, set on creation)

- a specific address for each vault, typically a multisig
- can call `committeeCheckIn` to claim it's role - only after the committee has checked in, deposits to the vault are enabled
- can call `setCommittee` - set new committee address. Can be called by existing committee if it had checked in, or by the governance otherwise.
- can call `submitClaim` - submit a claim for a bounty payout

## `RewardController.owner`

- set to HATS governance (not timelocked)
- can call `setEpochRewardPerBlock`
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
- can call `execute` and `executeBatch` to execute a scheduled operation

## `HATTimelockController.CANCELLER_ROLE`

- set to governance multisig
- can call `cancel` and cancel any pending operation


## The following functions in HATVaults are **not** subject to a timelock:
  - `approveClaim`
  - `setVaultVisibility`
  - `setVaultDescription`
  - `setDepositPause`
  - `setAllocPoints`
  - `swapAndSend`
