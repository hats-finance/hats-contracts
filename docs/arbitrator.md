# Arbitrator Interface

In Hats v2, we created a generic arbitration procedure in case some party does not agree with the size of the bounty assigned by the Committee.

The idea is that there is an `arbitrator` contract which implements a dispute mechanism. User can start a dispute via the `arbitrator` contracts, which will pause the vault until the `arbitrator` resolves the dispute. The HATVaults contract only implements some time-out checks in case the arbitrator does not resolve the dispute in time.

1. The `committee` of a vault submits a claim 
2. A challenge period starts in which anyone can challenge the claim
3. If nobody challenges the claim during the challenge period, the claim is paid out as set by the committee
4. If the claim is challenged, then the `aribtrator` can either dismiss the claim, or approve the claim but with a different amount
5. If the arbitrator does not approve or dismiss a challenged claim, then after a dispute period, the claim is dismissed


More precisely:

1. The `committee` calls `submitClaim(poolId, beneficiary, bountyPercentage)`. This will create a new `claimId`
2. The `arbitrator` can call `challengeClaim(_claimId)` at any time
3. If `challengePeriod` has passed and the claim was not challenged, anyone can call `approveClaim` and approve the claim. The bountyPercentage remains that as chosen by the committee
4. If the claim is challenged, `arbitrator` can either call `approveClaim(claimId, bountyPercentage)`  (and set a new bounty percentage) or can call `dismissClaim` to reject the claim alltogether
5. If `challengeTimeOutPeriod` passed, anyone can call `dismissClaim` and dismiss the claim

During the time from submitting a claim to its resolution, the vault will be locked for withdrawals. 




