# Roles, permissions and centralization risk

The Hats.finance vault system depends on a number of roles that together manage the system and the processing of claims.

- `registry.owner` - the owner of the Hats registry, which is Hats governance
- `vault.owner` - the owner of the vault, which can be, but is not necessarily, Hats governance
- `committee` - the party that is responsible for submitting claims for the vault
- `arbitrator` - the party that is responsible for resolving disputes regarding claims


## Publicly available functions

- `registry.createVault`
- `registry.logClaim`
- `vault.withdrawRequest`
- `vault.withdrawAndClaim`
- `vault.redeemAndClaim`
- `vault.emergencyWithdraw`
- `vault.withdraw`
- `vault.redeem`
- `vault.deposit`


## `HATVaultsRegistry.owner`

- `swapAndSend` and swap and send the vault's token that are earmarked for payout in HAT tokens (after approveClaim)

The registry owner controls a number of global settings, including a number of default settings that can be overridden per vault. 
See [parameters](./parameters.md) for the list of parameters managed by the owner of the registry


## `registry.feeSetter`

The `feeSetter` controls the fee on withdrawals from all vaults. 
See [parameters](./parameters.md) for the list of parameters managed by the feeSetter


## `vault.owner`

The owner of the Hat vault manages vault-specific parameters that are not essential to the protocol. 
See [parameters](./parameters.md) for the list of parameters managed by the owner of the vault. 


## `vault.committee`

- `submitClaim` - submit a claim for a bounty payout

The committee of each vault is in charge of submitting claims for bounty payouts. It is set on creation of the vault.
See [parameters](./parameters.md) for the list of parameters managed by the owner of the vault.


## `vault.arbitrator | registry.defaultArbitrator`

- `challengeClaim` to challenge a claim for a bounty payout that was previously submitted by a vault's committee
- `approveClaim` to approve a claim for a bounty payout that was previously challenged and change the bounty percentage (in case the claim was not challenged and the challengePeriod had ended - anyone can approve the claim without changing the bounty percentage)
- `dismissClaim` to dismiss a claim for a bounty payout that was previously challenged (in case the claim was challenged and the challengeTimeOutPeriod had ended - anyone can dismiss the claim)


## `rewardController.owner`

See [parameters](./parameters.md) for the list of parameters managed by the owner of the reward controller


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


# CENTRALIZATION RISKS

Below is a list of known centralization risks. It lists possible attacks or failure modes that could happen if one of the roles in the Hats system is taken over by a hostile or very incompetent party. 



In the [parameters](./parameters.md) document we list which parameters are controlled by each of these roles.

|who|special power|mitigation|
|-|-|-|
!registry.owner|block submissions and deposits, mints and transfers by calling `setEmergencyPaused`|by design| 
|registry.owner|block all or specific transfers (including deposit/withdraw) by setting the reward controller to an invalid or malicious address|users can call `emergencyWithdraw`|
|registry.owner|can take disproportionate share of bounties by manipulating the part that is swapped to HATs and sent to governance |maximum value is limited to 20%, the setter subject to time lock, which mitigates the problem|
|registry.owner|block logging of claims by setting a very high claimFee|no, but it is easy to find other communication channels, no crucial systems depend on that
|vault.owner|block future payouts by setting maxBounty to 0|no users funds are at risk 
|vault.owner|block deposits by calling `setDepositPause`|by design|
|arbitrator (and registry.owner via setArbitrator)|control bounty size|by design; arbitrators can be blocked from changing bounty percentage |
| committee + arbitrator |empty vault by submitting and approving claims|by design|
| committee  + registryOwner |owner can set arbitrator to itself, and then empty vault by submitting and approving claims|by design|
|committee|block payouts by never submitting claims|by design|
|committee|block payouts for ever by calling `setCommittee(0xdead)`|by design|
|arbitrator|block payouts by dismissing all claims|by design - registry owner can change the arbitrator if it is malicious|
|arbitrator|temporarily block withdrawals for challengeTimeOutPeriod (<85 days)|by design - registry owner cna change the arbitrator if it is malicious|
|committee and arbitrator|block withdrawals by re-submitting and challenging it during each safety period|by design. registry owner can change the arbitrator, if they collude
|rewardController.owner|empty reward controller by calling `sweepToken`|by design| 
