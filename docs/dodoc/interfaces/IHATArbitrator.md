# IHATArbitrator









## Methods

### acceptDispute

```solidity
function acceptDispute(contract IHATVault _vault, bytes32 _claimId, uint16 _bountyPercentage, address _beneficiary, address[] _disputersToRefund, address[] _disputersToConfiscate, string _descriptionHash) external nonpayable
```

Acccept the dispute - i.e. rule in favor of the disputers and against the original claim from the committee Can only be called by the Expert Committee The expert committee can include a payment for their service in the payout process



#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract IHATVault | the address of the vault where the claim was started |
| _claimId | bytes32 | id of the claim that was disputed. Must be the currently active claim |
| _bountyPercentage | uint16 | the percentage of the vault that will be paid out to the _beneficiary |
| _beneficiary | address | the (new) benficiary of the claim |
| _disputersToRefund | address[] | array of addresses of disputers that will get their bond back |
| _disputersToConfiscate | address[] | array of addresses of disputers that will lose their bond |
| _descriptionHash | string | a motivation of the ruling |

### approveSubmitClaimRequest

```solidity
function approveSubmitClaimRequest(contract IHATVault _vault, bytes32 _internalClaimId, address _beneficiary, uint16 _bountyPercentage, string _descriptionHash) external nonpayable
```

Submit a new claim on the basis of a submitClaimRequest only calleable by the expert committee the claim must be submitted within the submitClaimRequestReviewPeriod



#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract IHATVault | the vault where the claim was created |
| _internalClaimId | bytes32 | the id of the claim to approve |
| _beneficiary | address | the (new) benficiary of the claim |
| _bountyPercentage | uint16 | the percentage of the vault that will be paid out to the _beneficiary |
| _descriptionHash | string | a motivation for the claim |

### challengeResolution

```solidity
function challengeResolution(contract IHATVault _vault, bytes32 _claimId, string _evidence) external payable
```

Challenge a resolution of the expert committee - i.e. bring it to the attation of the court



#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract IHATVault | the address of the vault where the claim was started |
| _claimId | bytes32 | id of the claim that was disputed. Must be the currently active claim |
| _evidence | string | URI of the evidence to support the challenge |

### confiscateDisputers

```solidity
function confiscateDisputers(contract IHATVault _vault, bytes32 _claimId, address[] _disputersToConfiscate) external nonpayable
```

Forfeit the bonds of the given list of disputers. Their bonds will be sent to the expert committee



#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract IHATVault | the address of the vault where the claim was started |
| _claimId | bytes32 | id of the claim that was disputed. Must be the currently active claim |
| _disputersToConfiscate | address[] | a list of addresses of disputers whose bond will be forfeited |

### dismissDispute

```solidity
function dismissDispute(contract IHATVault _vault, bytes32 _claimId, string _descriptionHash) external nonpayable
```

Dismiss the dispute - i.e. approve the original claim from the committee Can only be called by the expert commmittee. The expert committee will receive the bonds of the disputers as a payment for their service



#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract IHATVault | the address of the vault where the claim was started |
| _claimId | bytes32 | id of the claim that was disputed. Must be the currently active claim |
| _descriptionHash | string | an (ipfs) hash representing the motiviations of the dismissal |

### dismissResolution

```solidity
function dismissResolution(contract IHATVault _vault, bytes32 _claimId) external nonpayable
```

Dismiss a resolution from the expert committee can only be called by the court



#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract IHATVault | the address of the vault where the claim was started |
| _claimId | bytes32 | id of the claim that was disputed. Must be the currently active claim |

### dismissSubmitClaimRequest

```solidity
function dismissSubmitClaimRequest(bytes32 _internalClaimId, string _descriptionHash) external nonpayable
```

Dismiss a request to create a claim. Can only be called by the expert committee



#### Parameters

| Name | Type | Description |
|---|---|---|
| _internalClaimId | bytes32 | the id of the claim to dismiss |
| _descriptionHash | string | a motivation for the dismissal |

### dispute

```solidity
function dispute(contract IHATVault _vault, bytes32 _claimId, uint256 _bondAmount, string _descriptionHash) external nonpayable
```

Dispute the commitee&#39;s claim Can be called by anyone



#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract IHATVault | the vault that the claim was created |
| _claimId | bytes32 | the id of the claim |
| _bondAmount | uint256 | Amount of tokens that the disputer will put up as a bond. This must be at least minBondAmount. The dispute is accepted if the total amount of bonds exceeds bondsNeededToStartDispute |
| _descriptionHash | string | undefined |

### executeResolution

```solidity
function executeResolution(contract IHATVault _vault, bytes32 _claimId) external nonpayable
```

execute a resolution from the expert committee if the resolution was challenged, this can only be called by the court if the resolution was not challenged durring the resolutionChallengePeriod, this can be called by anyone



#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract IHATVault | the address of the vault where the claim was started |
| _claimId | bytes32 | id of the claim that was disputed. Must be the currently active claim |

### reclaimBond

```solidity
function reclaimBond(contract IHATVault _vault, bytes32 _claimId) external nonpayable
```

reclaim a bond that msg.sender has put up for a given claim



#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract IHATVault | the address of the vault where the claim was started |
| _claimId | bytes32 | id of the claim that was disputed. Must be the currently active claim |

### refundDisputers

```solidity
function refundDisputers(contract IHATVault _vault, bytes32 _claimId, address[] _disputersToRefund) external nonpayable
```

release the bonds of the disputers, so that they can claim them back



#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract IHATVault | the address of the vault where the claim was started |
| _claimId | bytes32 | id of the claim that was disputed. Must be the currently active claim |
| _disputersToRefund | address[] | array of addresses |

### refundExpiredSubmitClaimRequest

```solidity
function refundExpiredSubmitClaimRequest(bytes32 _internalClaimId) external nonpayable
```

Refund the bond of the claimRequest by the sumbitter of the claim



#### Parameters

| Name | Type | Description |
|---|---|---|
| _internalClaimId | bytes32 | the claim of which the bond will be refunded |

### setCourt

```solidity
function setCourt(address _court) external nonpayable
```

Sets the address of the court Can be called only once and only by the owner



#### Parameters

| Name | Type | Description |
|---|---|---|
| _court | address | the address of the decentralized court contract |

### submitClaimRequest

```solidity
function submitClaimRequest(string _descriptionHash) external nonpayable
```

Submit a request for the expert committee to consider a claim A security researcher can use this if his claim is ignored by the committee The requester must provide a bond, which they will lose if the claim is considered invalid by the committee



#### Parameters

| Name | Type | Description |
|---|---|---|
| _descriptionHash | string | a hash of a description of the claim |



## Events

### BondRefundClaimed

```solidity
event BondRefundClaimed(contract IHATVault indexed _vault, bytes32 indexed _claimId, address _disputer, uint256 _amountClaimed)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault `indexed` | contract IHATVault | undefined |
| _claimId `indexed` | bytes32 | undefined |
| _disputer  | address | undefined |
| _amountClaimed  | uint256 | undefined |

### ClaimDisputed

```solidity
event ClaimDisputed(contract IHATVault indexed _vault, bytes32 indexed _claimId, address indexed _disputer, uint256 _bondAmount, string _descriptionHash)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault `indexed` | contract IHATVault | undefined |
| _claimId `indexed` | bytes32 | undefined |
| _disputer `indexed` | address | undefined |
| _bondAmount  | uint256 | undefined |
| _descriptionHash  | string | undefined |

### CourtSet

```solidity
event CourtSet(address indexed _court)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _court `indexed` | address | undefined |

### DisputeAccepted

```solidity
event DisputeAccepted(contract IHATVault indexed _vault, bytes32 indexed _claimId, uint16 _bountyPercentage, address _beneficiary, string _descriptionHash)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault `indexed` | contract IHATVault | undefined |
| _claimId `indexed` | bytes32 | undefined |
| _bountyPercentage  | uint16 | undefined |
| _beneficiary  | address | undefined |
| _descriptionHash  | string | undefined |

### DisputeDismissed

```solidity
event DisputeDismissed(contract IHATVault indexed _vault, bytes32 indexed _claimId, string _descriptionHash)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault `indexed` | contract IHATVault | undefined |
| _claimId `indexed` | bytes32 | undefined |
| _descriptionHash  | string | undefined |

### DisputersConfiscated

```solidity
event DisputersConfiscated(contract IHATVault indexed _vault, bytes32 indexed _claimId, address[] _disputers)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault `indexed` | contract IHATVault | undefined |
| _claimId `indexed` | bytes32 | undefined |
| _disputers  | address[] | undefined |

### DisputersRefunded

```solidity
event DisputersRefunded(contract IHATVault indexed _vault, bytes32 indexed _claimId, address[] _disputers)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault `indexed` | contract IHATVault | undefined |
| _claimId `indexed` | bytes32 | undefined |
| _disputers  | address[] | undefined |

### ResolutionChallenged

```solidity
event ResolutionChallenged(contract IHATVault indexed _vault, bytes32 indexed _claimId)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault `indexed` | contract IHATVault | undefined |
| _claimId `indexed` | bytes32 | undefined |

### ResolutionDismissed

```solidity
event ResolutionDismissed(contract IHATVault indexed _vault, bytes32 indexed _claimId)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault `indexed` | contract IHATVault | undefined |
| _claimId `indexed` | bytes32 | undefined |

### ResolutionExecuted

```solidity
event ResolutionExecuted(contract IHATVault indexed _vault, bytes32 indexed _claimId)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault `indexed` | contract IHATVault | undefined |
| _claimId `indexed` | bytes32 | undefined |

### SubmitClaimRequestApproved

```solidity
event SubmitClaimRequestApproved(bytes32 indexed _internalClaimId, bytes32 indexed _claimId, contract IHATVault indexed _vault)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _internalClaimId `indexed` | bytes32 | undefined |
| _claimId `indexed` | bytes32 | undefined |
| _vault `indexed` | contract IHATVault | undefined |

### SubmitClaimRequestCreated

```solidity
event SubmitClaimRequestCreated(bytes32 indexed _internalClaimId, address indexed _submitter, uint256 _bond, string _descriptionHash)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _internalClaimId `indexed` | bytes32 | undefined |
| _submitter `indexed` | address | undefined |
| _bond  | uint256 | undefined |
| _descriptionHash  | string | undefined |

### SubmitClaimRequestDismissed

```solidity
event SubmitClaimRequestDismissed(bytes32 indexed _internalClaimId, string _descriptionHash)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _internalClaimId `indexed` | bytes32 | undefined |
| _descriptionHash  | string | undefined |

### SubmitClaimRequestExpired

```solidity
event SubmitClaimRequestExpired(bytes32 indexed _internalClaimId)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _internalClaimId `indexed` | bytes32 | undefined |



## Errors

### AlreadyChallenged

```solidity
error AlreadyChallenged()
```






### AlreadyResolved

```solidity
error AlreadyResolved()
```






### BondAmountSubmittedTooLow

```solidity
error BondAmountSubmittedTooLow()
```






### CanOnlyBeCalledByCourt

```solidity
error CanOnlyBeCalledByCourt()
```






### CannontChangeCourtAddress

```solidity
error CannontChangeCourtAddress()
```






### CannotClaimBond

```solidity
error CannotClaimBond()
```






### CannotDismissUnchallengedResolution

```solidity
error CannotDismissUnchallengedResolution()
```






### CannotSubmitMoreEvidence

```solidity
error CannotSubmitMoreEvidence()
```






### ChallengePeriodDidNotPass

```solidity
error ChallengePeriodDidNotPass()
```






### ChallengePeriodPassed

```solidity
error ChallengePeriodPassed()
```






### ClaimExpired

```solidity
error ClaimExpired()
```






### ClaimIsNotCurrentlyActiveClaim

```solidity
error ClaimIsNotCurrentlyActiveClaim()
```






### ClaimIsNotDisputed

```solidity
error ClaimIsNotDisputed()
```






### ClaimReviewPeriodDidNotEnd

```solidity
error ClaimReviewPeriodDidNotEnd()
```






### ClaimReviewPeriodEnd

```solidity
error ClaimReviewPeriodEnd()
```






### CourtCannotBeZero

```solidity
error CourtCannotBeZero()
```






### NoResolution

```solidity
error NoResolution()
```






### OnlyExpertCommittee

```solidity
error OnlyExpertCommittee()
```






### bondsNeededToStartDisputeMustBeHigherThanMinAmount

```solidity
error bondsNeededToStartDisputeMustBeHigherThanMinAmount()
```







