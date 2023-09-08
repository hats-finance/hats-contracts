# Submission and arbitration of claims for bounty payouts

In Hats v2, we created a generic arbitration procedure in case some party does not agree with the size of the bounty assigned by the Committee.

Claims can be disputed via an `arbitrator` contract, which implements a dispute mechanism.  The `arbitrator` can pause the payout of the claim until he resolves the dispute. Hats finance provides a default arbitration procedure, but single vaults can override this procedure by choosing a different arbitration contract.

The HATVaults contract only implements some time-out checks in case the arbitrator does not resolve the dispute in time:

1. The `committee` of a vault submits a claim 
2. A challenge period starts, in which the arbitrator contract can challenge the claim
3. If nobody challenges the claim during the challenge period, the claim is paid out as set by the committee
4. If the claim is challenged, then the `arbitrator` can choose to either dismiss the claim, or to approve it. On some vaults, the arbitrator is allowed to change bounty percentage as well.
5. If the arbitrator does not approve or dismiss a challenged claim, then after a dispute period, the claim is automatically dismissed (this is a safeguard if for some reason the aribtrator becomes unavailable)
6. If any of these processes times out due to inactivity, the claim is dismissed


## Details and restrictions

There are 3 "periods" relevant for the handling of a new claim:
1. Challenge Period: the first `challengePeriod` seconds after the submission of the claim 
1. Challenge Timeout Period: the `challengeTimeOutPeriod` seconds after the challenge period ended
1. Expiration: after `challengePeriod + challengeTimeoutPeriod` seconds after the submission of the claim

The whole flow from submission of a vulnerability up to payout (or dismissal) of the claim then works as follows:


### SUBMISSION

  `submitClaim(beneficiary, bountyPercentage)` will create a new `claimId`.
   - `submitClaim` can only be called by the committee
   - `submitClaim` can only be called during a safety period
   - `submitClaim` can only be called if no other active claim exists
   - emergencyPause must not be in effect

 ### CHALLENGE 
 
 `challengeClaim(_claimId)` 
   - can only be called during the challenge period
   - only the `arbitrator` or the `registry.owner` can challenge a claim (the registry.owner functions here as a "challenger of last resort")
   - can only be called if the claim has not been challenged yet

### APPROVAL
`approveClaim(_claimId, bountyPercentage)`
   - during the challenge period and challenge timeout period:
    - if the claim is challenged (during the challenge period), and no more than `challengeTimoutPeriod` seconds have passed since the challenge, the arbitrator can call `approveClaim`. The arbitrator can change the bountyPercentage if given the permission
   - during the challenge timeout period:
    - if the challenge period had passed and the claim was not challenged (but is not yet expired), anyone can call `approveClaim` and approve the claim. In that case, the bountyPercentage remains that as chosen by the committee

[More details about the payout are here](./payout.md)

###  DISMISSAL

`dismissClaim(_claimId)`
    - during the challenge period and challenge timeout period:
      - if the claim was challenged, the arbitrator can dismiss the claim
    - after challengePeriod + challengeTimeoutPeriod, the claim is _expired_  and:
      - anyone can dismiss the claim

During the time from submitting a claim to its resolution (i.e. approval or dismissal), the vault will be locked for withdrawals, and no new claims can be submitted

## Relevant settings

- `challengePeriod`: length of challlenge period, in seconds
- `challengeTimeoutPeriod`: length of time a challenged claim can be approved
- `arbitratorCanChangeBounty`: determines whether the arbitrator can change the bounty percentage when approving a claim