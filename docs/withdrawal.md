  

## Withdrawal process

The funds that a user has deposited in the vault can be paid out as a bounty to hackers. 

HATs has implemented some time limits on withdrawals to make sure that a users will not withdraw their funds just before a claim is submitted or is paid out. 

This means that a user cannot withdraw her funds:

- When a claim has been submitted, but has not been approved or dismissed yet
- During a regular fixed period during which claims can be submitted

More precisely, this workds as follows:

- Before withdrawing, a user calls`withdrawRequest` at time `t`. This can be called at any time

The user can call `withdraw` or `redeem` and withdraw all or part of her funds only if
  1. The current time is later than `t + withdrawEnableStartTime` but before `t + withdrawEnableSTartTime + withdrawRequestEnablePeriod`
  2. the current time is during the withdraw period
  3. there is no active claim

- If the user deposits new funds to her account, the withdraw request is cancelled (i.e. `t` is reset to 0)
- If a withdrawRequest is active, other users can not deposit or transfer tokens to this account


```

withdrawRequest()
       |<--     withdrawEnableSTartTime    --> <-withdrawRequestEnablePeriod->  
       |--------------------------------------|-------------------------------| 
----------------|------------------|----------------|------------------|---.....
 <-safetyPeriod-> <-withdrawPeriod-> <-safetyPeriod-> <-withdrawPeriod->
 

```