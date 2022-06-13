# Arbitrator Interface

In Hats v2, we created a generic arbitration procedure in case some party does not agree with the size of the bounty assigned by the Committee.

The procedure looks as follows:


1. The `committee` of a vault submits a claim 
2. A challenge period starts in which anyone can challenge the claim
3. If nobody challenges the claim during the challenge period, the claim is paid out as set by the committee
4. If the claim is challenged, then the `aribtrator` will validate the claim and can assign a different amount
5. If the arbitrator did not express itself during a dispute period, the claim is dimissed


More precisely:

1. The `committee` calls `submitClaim(poolId, beneficiary, bountyPercentage)`
2. The `arbitrator` can call `challengeClaim(_claimId)` at any time
3. If `challengePeriod` has passed and the claim was not challeged, anyone can call `approveClaim` and approve the claim with the bountyPercentage as set by the committee
4. If the claim is challenged, `arbitrator` can either call `approveClaim(claimId, bountyPercentage)`  (and set a new bounty percentage) or can call `dismissClaim` to reject the claim alltogether
5. If `challengeTimeOutPeriod` passed, anyone can call `dismissClaim` and dismiss the claim

During the time from submitting a claim to its resolution, the vault will be locked for withdrawals. 




