
## Deposit process 

User deposits `amount` tokens of the contract at `token` in a `vault`
1. User first approves the token: `token.approve(vault.address, amount)`
1. User deposits the tokens by calling: `vault.deposit(amount, receiver)`
  1. `amount` tokens are transferred to the `vault` contract
  1. user gets minted `shares` in the vault that reflect her deposit 

  

## Withdrawal process

The funds that a user has deposited in the vault can be paid out as a bounty to hackers. 

Hats has implemented some time limits on withdrawals to make sure that users will not withdraw their funds while a claim is being processed. 

This means that a user cannot withdraw her funds:

- When a claim has been submitted, but has not been approved or dismissed yet
- During a regular fixed period during which claims can be submitted (called `safetyPeriod`)

More precisely, this works as follows:

- Before withdrawing, a user calls `withdrawRequest` at time `t`. This can be called at any time

The user can call `withdraw` or `redeem` and withdraw all or part of her funds only if
  1. The current time is later than `t + withdrawRequestPendingPeriod` but before `t + withdrawRequestPendingPeriod + withdrawRequestEnablePeriod`
  2. the current time is during the withdraw period
  3. there is no active claim

- If the user deposits new funds to her account, the withdraw request is cancelled (i.e. `t` is reset to 0)
- If a withdrawRequest is active, other users can not deposit or transfer tokens to this account


```

withdrawRequest()
       |<--  withdrawRequestPendingPeriod  --> <-withdrawRequestEnablePeriod->  
       |--------------------------------------|-------------------------------| 
----------------|------------------|----------------|------------------|---.....
 <-safetyPeriod-> <-withdrawPeriod-> <-safetyPeriod-> <-withdrawPeriod->
 

```