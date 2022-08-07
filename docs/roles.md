# Security Analysis HATVaults 2.0

**Some of the functions have changed after this document has written**

The contracts in this repository define a number of different roles that have the power to change the way the contracts work. We list them here, with a short description of what an account with this role can do, and to which account this role will be assigned on deployment

## `HatVaults.ProxyOwner`

- set to `HATTimelockController`
- can upgrade the proxy
- can `transferOwnership` and `renounceOwnership`

## `HatVaults.owner`

The `owner` of hatvaults is HATs governance (currently a multisig, a DAO in the future), limited by a modified TimeLock (which means that the owner can call essential functions only with a delay set by the Timelock)

- set to `HATTimelockController`
- can call `transferOwnership` and `renounceOwnership` of `HATVaults`
- can call `createVault` to create a new vault
- can call `updateVaultInfo` to change the vault's properties
- can call `approveClaim` to approve a claim for a bounty payout that was previously submitted by a vault's committee
- can call `swapBurnSend` and swap, burn, and send the vauit's token that are earmarked for payout (after approveClaim)
- can call `setClaimFee` set fee for submitting a vulnerability
- can call `setWithdrawRequestParams` set time limits for withdrawal requests
- can call `setWithdrawSafetyPeriod` set the amount of time during which claims can be submitted; during this time the vault users can not withdraw their funds. Must be less than 6 hours
- can call `setBountySplit` set how the bounty is split betwen security researcher, committee and governance
- can call `setRouterWhitelistStatus` add or remove address from the whitelist of routers that can be used for token swapping
- can call `setVestingParams` set vesting parameters for bounty paid in lptoken
- can call `setHatVestingParams` set vesting paramaters for bounty paid in hats
- can call `setBountyLevelsDelay` set how long a committee needs to wait bf changing the bounty levels
- setMaxBountyDelay - Set the timelock delay for setting the max bounty
- can call `setFeeSetter` set the feeSetter role
- can call `setCommittee` but only if the committee has not checked in yet

## `HatVaults - Vault committee` (committee set by each vault)

- a specific address for each vault, typically a multisig
- can call `committeeCheckIn`  to claim it's role - only after the committee has checked in, deposits to the vault are enabled
- can call `setCommittee` - set new committee address. Can be called by existing committee if it had checked in, or by the governance otherwise.
- can call `submitClaim` - submit a claim for a bounty payout
- can call `setWithdrawalFee` - set the fee for withdrawals from the vault

## `HatVaults.feeSetter`

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
- The following functions in HATVaults are **not** subject to a timelock:
  - `approveClaim`
  - `updateVaultInfo`
  - `setAllocPoints`
  - `swapBurnSend`
