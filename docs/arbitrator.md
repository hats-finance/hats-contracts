# Arbitrator Interface

In Hats v2, we created a generic arbitration procedure in case some party does not agree with the size of the bounty assigned by the Committee.

Claims can be disputed via an `arbitrator` contract which implements a dispute mechanism. User can start a dispute, which will pause the vault until the `arbitrator` resolves the dispute. 

The HATVaults contract only implements some time-out checks in case the arbitrator does not resolve the dispute in time.

1. The `committee` of a vault submits a claim 
2. A challenge period starts in which anyone can challenge the claim
3. If nobody challenges the claim during the challenge period, the claim is paid out as set by the committee
4. If the claim is challenged, then the `arbitrator` can either dismiss the claim, or approve the claim but with a different amount
5. If the arbitrator does not approve or dismiss a challenged claim, then after a dispute period, the claim is dismissed


More precisely:

1. **SUMBISSION** `submitClaim(beneficiary, bountyPercentage)` will create a new `claimId`.
  - `submitClaim` can only be called by the committee
  - `submitClaim` can only be called during the safety period
  - `submitClaim` can only be called if no other active claim exists
  - only the committe can call `submitClaim`
  - emergencyPause is not in effect
1. **CHALLENGE** `challengeClaim(_claimId)` 
  - can only be called during the challengePeriod
  - Only the  `arbitrator` or the `registry.owner` can challenge a claim
  - _claimId must be the id of the active claim
  - the claim has not been challenged before
  - challengePeriod must not have expired
  - only the arbitrator can call challengeClaim
1. **APPROVAL** `approveClaim(_claimId, bountyPercentage)`
  - During the challengePeriod:
    - the claim must be challenged
    - only arbitrator can call aproveClaim
  - After the challenge period:
    - if the claim was not challenged, anyone can call `approveClaim` and approve the claim. The bountyPercentage remains that as chosen by the committee
    - the bountyPercentage must be that of the original claim
  - _claimId must be the id of the active claim
1. **DIMISSAL** `dismissClaim(_claimId)`
  -  if a claim was challenged:
    - before challengeTimeoutPeriod, only the arbitrator can dismiss the claim
    - after challengeTimeOutPeriod, anyone can dismiss the claim
  - if the claim was never challenged, then after challengePeriod + challengeTimeoutPeriod, anoyone can dismiss the claim
  

During the time from submitting a claim to its resolution, the vault will be locked for withdrawals, and no new claims can be submitted



# Deployment

## Stage 1: arbitrator is HATs governance


## Stage 2: arbitrator is a  contract (mostly) controlled by HATs governance


## Stage 3: arbitrator is an (interface to) a decentralized system, such as Kleros, Aragon Court, UMA, ...




