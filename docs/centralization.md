# CENTRALIZATION RISKS

|who|can do|severity|addressed?|remarks
|-|-|-|-|-|
|registry.owner|block all transfers (including deposit/withdraw)|Critical|NOT ADDRESSED **TBD**|set reward controller to invalid address| 
|vault.owner|block specific transfers (including deposit/withdraw)|Critical|NOT ADDRESSED **TBD**|set reward controller to  malicious address
|registry.owner|take entire bounty|high|subject to timelock, which mitigates the problem, **TBD** set a limit?|set setHATBountySplit and get up to 100% of the bounty 
| committee + **DOS on arbitrator** |empty vault|info|**??** require arbitrator approval always?|approve any payout after challengetimeoutperiod|
|registry.owner|block logging of claims|info|**TBD** limit on claimfee?|set claim fee to a very high value
|vault.owner|block payouts|medium|**TBD** minimum on maxBounty|set maxBounty to 0
|vault.owner|block payout to hacker||**TBD**|set the bountysplit and give the entire bounty (minus registry-set fees) to the committee
|arbitrator (and registry.owner via setArbitrator)|control bounty size||by designbut  **not sure**|arbitrator can set the bountysize to her liking, ignoring the committee|
  
## KNOWN AND ACCEPTED

|who|can do|severity|addressed?|remarks
|-|-|-|-|-|
| committee  + registryOwner |empty vault|info|by design|registyrOwner sets arbitrator, then approves any submitted claim
| committee + arbitrator|empty vault|info|by design|approve any payout|
|commitee|block payouts|info|by design|by simply never calling submitClaim
|commitee|block payouts for ever|info|by design|call  `setCommittee(0xdead)`
|arbitrator|block payouts|info|by design|challenge and dismiss any claim
|arbitrator|temporarily block withdrawals for challengeTimeOutPeriod (<85 days)|info|by design|
|committee and arbitrator|block withdrawals|medium|not addressed|in each safety period before challengeTimeoutPeriod: resolving the active claim and resubmitting it, and challenging it
|registry.owner|can block withdrawals|medium|timelock and limits on values| by playing with safety periods and withdraw request timing 