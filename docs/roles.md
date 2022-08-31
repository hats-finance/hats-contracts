# Roles, permissinos and centralization risk

The HATVaults system depends a number of roles that together manage the system and the processing of claims.

- `registry.owner` - the owner of the HATs registry, which is HATs governance
- `vault.owner` - the owner of the vault, which can be, but is not necessarily, HATs governance
- `committee` - the party that is responsible for submitting claims
- `arbitrator` - the party that is responsible for resolving disputes regarding claims


## Publicly avilable functions

- `registry.createVault`

## `HATVaultsRegistry.owner`

- `swapAndSend` and swap and send the vauit's token that are earmarked for payout (after approveClaim)

The registry owner controls a number of global settings, including a number of default settings that can be overridden per vault. 
See [parameters](./parameters.md) for the list of parameters managed by the owner of the registry
## `registry.feeSetter`

The `feeSetter` controls the withdrawal fee. 

See [parameters](./parameters.md) for the list of parameters managed by the feeSetter



## `vault.owner`

The owner of the hat vault manages vault-specific parameters that are not essential to the protocol. 

See [parameters](./parameters.md) for the list of parameters managed by the owner of the vault. 


## `vault.committee` (committee of each vault, set on creation)

See [parameters](./parameters.md) for the list of parameters managed by the owner of the vault.

- `submitClaim` - submit a claim for a bounty payout


## `vault.arbitrator | registry.defaultArbitrator`

- `challengeClaim` to challenge a claim for a bounty payout that was previously submitted by a vault's committee
- `approveClaim` to approve a claim for a bounty payout that was previously challenged and change the bounty percentage (in case the claim was not challenged and the challengePeriod had ended - anyone can approve the claim without changing the bounty percentage)
- `dismissClaim` to dismiss a claim for a bounty payout that was previously challenged (in case the claim was challenged and the challengeTimeOutPeriod had ended - anyone can dismiss the claim)
(see [arbitrator](./arbitrator.md))



## `RewardController.owner`

See [parameters](./parameters.md) for the list of parameters managed by the owner of the rewardcontroller


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

Below is a list of known centralization risks. It lists possible attacks or failure modes that could happen if one of the roles in the HATs system is taken over by a hostile or very incompetent party. 



In the [parameters](./parameters.md) document we list which parameters are controlled by each of these roles.l

|who|special power|severity|mitigation|
|-|-|-|-|
!registyr.owner|block many interactions by calling `setEmergencyPaused`|info (by design)| 
|registry.owner|block all or specific transfers (including deposit/withdraw) by setting the reward controller to an invalid or malicious address|Critical|users can call `emergencyWithdraw`|
|registry.owner|can take disproportionate share bounty by minuplating HATBountySplit |high|maxium value is limited to 20%, the setter subject to timelock, which mitigates the problem|
|registry.owner|block logging of claims by setting a very high claimFee|info|no, but it is easy to find other communication channelsr,no crucial systems depend on that
|vault.owner|block future payouts by setting maxBounty to 0|low|no users funds are at risk 
|vault.owner|block deposits by calling `setDepositPause`|info|
|arbitrator (and registry.owner via setArbitrator)|control bounty size||by design; we assume the arbitrator contract sets the conditions on which |
| committee + arbitrator |empty vault by sumbitting and approving claims|info|by design|
| committee  + registryOwner |owner can set arbitrator to itself, and then empty vault by submitting and approving claimst|info|by design|
|commitee|block payouts by never submitting claims|info|by design|
|commitee|block payouts for ever by calling `setCommittee(0xdead)`|info|by design|
|arbitrator|block payouts by dismissing all claims|info|by design - registyr owner can change the arbitrator if it is malicious|
|arbitrator|temporarily block withdrawals for challengeTimeOutPeriod (<85 days)|info|by design - registry owner cna change the arbitrator if it is malicious|
|committee and arbitrator|block withdrawals by re-submtting and challenging it during each safetey period|info (by design)|registry owner cna change the arbitrator, if they collude