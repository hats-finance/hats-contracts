# Arbitration for HATS 2.0

## Motivation

Currently, HATs vaults are used for Bug Bounties and Audit Competitions. The procedure for payout is simple: each vault has a committee that judges the submissions and decides on a payout. 

In HATs v2.0, there is a safeguard against malicious behavior of the committee - HATs can veto the payout. However, there is no similar guarantee for security researchers that submit issues. If a security researcher is unhappy with the payout, they have no formal recourse (currently, they can write to HATs and we will try to mediate, but the committee has the final word). This is a problem, because the committee often represents the people or organization that have put up the funds in the vault, and so have an interest to keep the payout as low as possible.

## Optimistic Arbitration

In this document, we describe a formal, on-chain, process in which contributors can challenge the committee’s decision

In very broad terms, if there is a conflict, the decision can be delegated to a neutral “expert committee”. If the expert committee does not manage to find a solution that is good for everyone, the final decision can be referred to a decentralized court (such as Kleros or UMA). 


> Optimistic arbitration: an expert committee arbitrates, and this decision is accepted unless decentralized court explicitly rejects

There are two ways in which a payout can be created. In the default system, claims are submitted by the vault's committee. These claims can then be disputed and brought to attention to an Expert Committee, and if necessary escalated to a decentralized court such as Kleros. As this process is still gate-kept by the committee, we also offer a way to directly submit claims to the expert committee. 



![diagram of the dispute flow ](https://github.com/hats-finance/hats-contracts/blob/d1a9aa6dfe0def958fef0d12a2cf70896db129b0/docs/img/hatsv2.0-payout-flow.png | width=600)

## Dispute of Committee's claim


1. **Committee** creates claim X
  - `vault.submitClaim(_beneficiary, _bountyPercentage, _descriptionHash)`
  - a claim is a proposal to payout a percentage of the vault to one or more beneficiaries

2. **Anyone** can dispute the claim by calling `arbitrator.dispute(_claimId, _ipfsHash, _bondAmount)`
  -  Participating in the dispute requires a minimal bond of at least `minBondAmount`. Disputers will lose their bond if they lose the dispute.
  - There can be more than one challenger that takes part in the dispute process
  - When the combined amount of bonds exceeds `bondsNeededToStartDispute`, the payout is blocked and the dispute procedure described in step 3 is started
  - if the quorum of `bondsNeededToStartDispute` is not reached during the dispute period, no dispute is started, and the committee’s claim is paid out. Disputers can then reclaim their stake by calling `withdrawFeesAndRewards(...)`
  - The dispute period is equal to the challenge period in the vault

3. An expert committee considers the challenges and formulates a new claim:
  -  Different challenges are bundled together, and the challengers may not necessarily agree about the content of the challenge. The task of the expert committee is to judge the correctness and fairness of the original committee’s claim, weighing the evidence brought by all challengers, and if they believe the committee’s claim is unfair or incorrect, propose a new claim Y.
  - The expert committee either:
    - (3a) dismiss all original challenges (i.e. keeps original claim), in which case we can proceed to pay out X, 
      - `dismissDispute(_claimId)`
      - the expert committee gets paid from the bondsNeededToStartDispute that was collected from the challengers in step 2 (who lose their stake)
      - the process is finished

    - (3b) proposes a new claim Y  by calling `acceptDispute(_claimId, _bountyPercentage, _beneficiary, _disputersToRefund)`
      - this new claim may include a payout to the expert committee for their work (the amount is at the discretion of the expert committee)
      - expert committee also decides which of the challengers get their stake back
      - proceed to step 4.
    - the expert committee has expertCommitteeTimeoutPeriod to make a decision. If it does not make a decision within this period, the original claim is dismissed


4. In case of 3b, **anyone** can fund a dispute with the goal to dismiss the expert’s committees claim Y in a decentralized court (like Kleros, UMA)  
  - the challenge period is set by the variable `courtChallengePeriod`
  - if nobody challenges during the challenge period, we pay out Y; 
  - anyone can call `arbitrator.executeResolution(_claimId)` after the challenge period is over
  -  if there _is_ a challenge we go to step 5. 


5. The decentralized court is posed the question:

>  "has the expert committee formulated an honest payment by creating claim Y?"
  - in this first implementation, the decentralized court is Kleros
  - the court either calls `arbitrator.executeResolution(_claimId)` or
`arbitrator.dismissResolution(_claimId)`

6. The entire process from a successful dispute (i.e. in step  3) to its resolution (in step 6 in the worst case) is constrained by the vault.challengeTimeOutPeriod. In the case of Kleros, there is no absolute time limit on the process. 




## If the committee censors the claim 


The above procedure does not offer a recourse for a security researcher that has a legitimate claim, but the Committee accept the claim. In that case, the security researcher can ask the expert committee to submit the claim directly

6. The security researcher can bypass the committee and contact the expert committee by creating a claim request using `submitClaimRequest(_descriptionHash)`. 
  - This may require a bond. 

7. the Expert Committee considers the security researcher’s claim. 

  - a. If the claim is not valid, the expert committee dismisses the claim by calling `dismissSubmitClaimRequest( _internalClaimId, _descriptionHash)`
      - The submitter of the claim will lose their bond, which will go to the expert committee

  - b. If the claim is valid, the expert committee creates a new claim on the basis of the evidence, and calls  `approveSubmitClaimRequest( _vault, _internalClaimId,_beneficiary,_bountyPercentage,_descriptionHash)`

      - The claim may include fees for the expert committee

  - If the expert committee does not decide within `submitClaimRequestReviewPeriod`, the security researcher’s bond will be refunded, and the security researcher can  `refundExpiredSubmitClaimRequest(_internalClaimId)`


8. In the case of 3b, the expert committees claim can be disputed, just as before in step 4 and 5. 


## notes

*The arbitration procedure of kleros requires active involvement of both parties, and capital to fund eventual escalations of the procedures. We can assume that the challengers have a stake in the game here (i.e. they want to see the claim dismissed for financial reasons) and so can be expected to play an active role.*
