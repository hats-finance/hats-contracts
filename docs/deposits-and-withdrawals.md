
# Deposists and Withdrawls

Hats finance provides crowd-sourced bug bounties. Parties that are interested in helping protect a project can deposit funds in the Vault. 

The withdrawal of funds is subject to a certain number of restrictions, which are meant to make it hard for users to game the system - specifically, we do not want users to withdraw their funds just before a payout is scheduled. 


## Deposit 
User deposits `amount` tokens of the contract at `token` in a `vault`
1. User first approves the token: `token.approve(vault.address, amount)`
1. User deposits the tokens by calling: `vault.deposit(amount, receiver)`
  1. `amount` tokens are transferred to the `vault` contract
  1. user gets minted `shares` in the vault that reflect her deposit 

  

## Withdrawal 

The funds that a user has deposited in the vault can be paid out as a bounty to hackers.  Hats has implemented some time limits on withdrawals to make sure that users will not withdraw their funds while a claim is being processed, or just before a claim is being paid out.

Specifcally,  a user cannot withdraw her funds:

- While a claim is being processed (i.e. a claim has been submitted, but has not been approved or dismissed yet)
- During a regular fixed period during which claims can be submitted (called `safetyPeriod`) - in the default configuration, the safety period lasts one hour, and occurs every 12 hours

More precisely, this works as follows:

- Before withdrawing, a user calls `withdrawRequest()` at time `t`. This function can be called at any time
- The user can call `withdraw` or `redeem` and withdraw all or part of her funds only if
  1. The current time is later than `t + withdrawRequestPendingPeriod` but before `t + withdrawRequestPendingPeriod + withdrawRequestEnablePeriod`
  2. the current time is during the withdraw period (and not the safety period)
  3. there is no active claim being processed

- If the user deposits new funds to her account, the withdraw request is cancelled (i.e. `t` is reset to 0)
- If a withdrawRequest is active, other users can not deposit or transfer tokens to this account


```

withdrawRequest()
       |<--  withdrawRequestPendingPeriod  --> <-withdrawRequestEnablePeriod->  
       |--------------------------------------|-------------------------------| 
----------------|------------------|----------------|------------------|---.....
 <-safetyPeriod-> <-withdrawPeriod-> <-safetyPeriod-> <-withdrawPeriod->
 

```