# Security Analysis HATVaults 2.0

The contracts in this repository define a number of different roles that have the power to change the way the contracts work. We list them here, with a short description of what an account with this role can do, and to which account this role will be assigned on deployment

## `HatVaults.ProxyOwner`

- set to `HATTimelockController`
- can upgrade the proxy
- can `transferOwnership` and `renounceOwnership`

## `HatVaults.owner`

- set to `HATTimelockController`
- can `transferOwnership` and `renounceOwnership` of `HATVaults`
- can call `addPool` to add a pool
- can call `setPool` to change pool properties
- can call `approveClaim`
- can call `swapBurnSend` and swap, burn, and send pool tokens that are earmarked for payout (after approveClaim)
- can call `setClaimFee`
- can call `setWithdrawRequestParams` (set time limits for withdrawal requests)
- can call `setWithdrawSafetyPeriod` (set the times when the vault is locked for withdrawal)
- can call `setBountySplit` (set how the bounty is split)
- can call `setRouterWhitelistStatus` (add or remove address from the whitelist of routers)
- can call `setVestingParams` (set vesting parameters for bounty paid in lptoken)
- can call `setHatVestingParams` (set vesting paramaters for bounty paid in hats)
- can call `setBountyLevelsDelay` (set how long a committee needs to wait bf changing the bounty levels)
- can call `setFeeSetter` (set the feeSetter role)
- can call `setPoolInitialized` (Set an "initialized" flag to disable "setShares")
- can call `setShares` but only if the pool is not initialized
- can call `setCommittee` but only if the committee has not checked in yet

## `HatVaults - Vault committee` (committee set by each vault)

- a specific address for each vault, typically a multisig
- can call `committeeCheckIn`
- can call `setCommittee`
- can call `submitClaim`
- can call `setPendingBountyLevels`
- can call `setBountyLevels`
- can call `setPoolWithdrawalFee` (set the fee for withdrawals from the pool)

## `HatVaults.feeSetter`

- set to `HATTimeLockController`
- can call `setPoolWithdrawalFee` (set the fee for withdrawals from the pool)

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
- The following functions in HATVaults are **not** subject to a timelock:
  - `addPool`
  - `approveClaim`
  - `setPool`
  - `setAllocPoints`
  - `swapBurnSend`