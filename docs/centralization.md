# CENTRALIZATION RISKS

|who|result|severity|addressed?|remarks
|-|-|-|-|-|
|registry.owner|block all transfers (including deposit/withdraw)|Critical|NOT ADDRESSED|set reward controller to invalid address| 
|registry.owner|block specific transfers (including deposit/withdraw)|Critical|NOT ADDRESSED|set reward controller to  malicious address
|registry.owner|take entire bounty|high|subject to timelock, which mitagates the problem, but NOT ADDRESSED|set setHATBountySplit and get up to 100% of the bounty 
| committee + arbitrator|empty vault|info|by design|approve any payout|
| committee + **DOS on arbitrator** |empty vault|info|?????|approve any payout after challengetimeoutperiod|
| committee  + registryOwner |empty vault|info|by design|registyrOwner sets arbitrator, then approves any submitted claim
|registry.owner|block logging of claims|info|NOT ADDRESSED|set claim fee to a very high value
|commitee|block payouts|info|by design|by simply never calling submitClaim
|commitee|block payouts for ever|info|by design|call  `setCommittee(0xdead)`
|arbitrator|block payouts|info|by design|challenge and dismiss any claim
|vault.owner|block payouts|????||set maxBounty to 0
|vault.owner|block payout to hacker|????||set the bountysplit and give the entire bounty (minus registry-set fees) to the committee
|arbitrator|temporarily block withdrawals for challengeTimeOutPeriod (<85 days)|info|by design|
|committee and arbitrator|block withdrawals|medium|not addressed|in each safety period before challengeTimeoutPeriod: resolving the active claim and resubmitting it, and challenging it
|registry.owner|can block withdrawals|medium|timelock and limits on values| by playing with safety periods and withdraw request timing 
  