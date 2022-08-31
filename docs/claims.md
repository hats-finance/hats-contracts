# Submitting and approving claims for bounty payouts

In Hats v2, we created a generic arbitration procedure in case some party does not agree with the size of the bounty assigned by the Committee.

Claims can be disputed via an `arbitrator` contract which implements a dispute mechanism. User can start a dispute through the `arbitrator`, which can pause the claim until he resolves the dispute. 

The HATVaults contract only implements some time-out checks in case the arbitrator does not resolve the dispute in time.

1. The `committee` of a vault submits a claim 
2. A challenge period starts, in which the arbitrator can challenge the claim
3. If nobody challenges the claim during the challenge period, the claim is paid out as set by the committee
4. If the claim is challenged, then the `arbitrator` can either dismiss the claim, or approve the claim but with a different amount
5. If the arbitrator does not approve or dismiss a challenged claim, then after a dispute period, the claim is dismissed
6. If any of these processes times out due to inactivity, the claim is dismissed


## Details and restrictions

1. **SUBMISSION** 
  `submitClaim(beneficiary, bountyPercentage)` will create a new `claimId`.
   - `submitClaim` can only be called by the committee
   - `submitClaim` can only be called during a safety period
   - `submitClaim` can only be called if no other active claim exists
   - only the committee can call `submitClaim`
   - emergencyPause must not be in effect
1. **CHALLENGE** `challengeClaim(_claimId)` 
   - can only be called during the challengePeriod
   - only the  `arbitrator` or the `registry.owner` can challenge a claim (the registry.owner functions here as a "challenger of last resort")
   - the claim has not been challenged yet
   - `_claimId` must be the id of the currently active claim
1. **APPROVAL** `approveClaim(_claimId, bountyPercentage)`
   - during the challengePeriod:
     - the claim must be challenged
     - only the arbitrator can call `aproveClaim`
   - after the challenge period:
     - if the claim was not challenged, anyone can call `approveClaim` and approve the claim. The bountyPercentage remains that as chosen by the committee
     - the bountyPercentage must be that of the original claim
   - `_claimId` must be the id of the currently active claim
1. **DISMISSAL** `dismissClaim(_claimId)`
   -  if a claim was challenged:
      - before challengeTimeoutPeriod, only the arbitrator can dismiss the claim
      - after challengeTimeOutPeriod, anyone can dismiss the claim
    - if the claim was never challenged, then after challengePeriod + challengeTimeoutPeriod, anoyone can dismiss the claim
   - `_claimId` must be the id of the currently active claim

During the time from submitting a claim to its resolution, the vault will be locked for withdrawals, and no new claims can be submitted
