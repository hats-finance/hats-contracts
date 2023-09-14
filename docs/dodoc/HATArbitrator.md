# HATArbitrator









## Methods

### acceptDispute

```solidity
function acceptDispute(contract IHATClaimsManager _vault, bytes32 _claimId, uint16 _bountyPercentage, address _beneficiary, address[] _disputersToRefund, address[] _disputersToConfiscate, string _descriptionHash) external nonpayable
```

See {IHATArbitrator-acceptDispute}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract IHATClaimsManager | undefined |
| _claimId | bytes32 | undefined |
| _bountyPercentage | uint16 | undefined |
| _beneficiary | address | undefined |
| _disputersToRefund | address[] | undefined |
| _disputersToConfiscate | address[] | undefined |
| _descriptionHash | string | undefined |

### approveSubmitClaimRequest

```solidity
function approveSubmitClaimRequest(contract IHATClaimsManager _vault, bytes32 _internalClaimId, address _beneficiary, uint16 _bountyPercentage, string _descriptionHash) external nonpayable
```

See {IHATArbitrator-approveSubmitClaimRequest}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract IHATClaimsManager | undefined |
| _internalClaimId | bytes32 | undefined |
| _beneficiary | address | undefined |
| _bountyPercentage | uint16 | undefined |
| _descriptionHash | string | undefined |

### bondClaimable

```solidity
function bondClaimable(address, contract IHATClaimsManager, bytes32) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |
| _1 | contract IHATClaimsManager | undefined |
| _2 | bytes32 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### bondsNeededToStartDispute

```solidity
function bondsNeededToStartDispute() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### challengeResolution

```solidity
function challengeResolution(contract IHATClaimsManager _vault, bytes32 _claimId, string _evidence) external payable
```

See {IHATArbitrator-challengeResolution}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract IHATClaimsManager | undefined |
| _claimId | bytes32 | undefined |
| _evidence | string | undefined |

### confiscateDisputers

```solidity
function confiscateDisputers(contract IHATClaimsManager _vault, bytes32 _claimId, address[] _disputersToConfiscate) external nonpayable
```

See {IHATArbitrator-confiscateDisputers}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract IHATClaimsManager | undefined |
| _claimId | bytes32 | undefined |
| _disputersToConfiscate | address[] | undefined |

### court

```solidity
function court() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### dismissDispute

```solidity
function dismissDispute(contract IHATClaimsManager _vault, bytes32 _claimId, string _descriptionHash) external nonpayable
```

See {IHATArbitrator-dismissDispute}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract IHATClaimsManager | undefined |
| _claimId | bytes32 | undefined |
| _descriptionHash | string | undefined |

### dismissResolution

```solidity
function dismissResolution(contract IHATClaimsManager _vault, bytes32 _claimId) external nonpayable
```

See {IHATArbitrator-dismissResolution}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract IHATClaimsManager | undefined |
| _claimId | bytes32 | undefined |

### dismissSubmitClaimRequest

```solidity
function dismissSubmitClaimRequest(bytes32 _internalClaimId, string _descriptionHash) external nonpayable
```

See {IHATArbitrator-dismissSubmitClaimRequest}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _internalClaimId | bytes32 | undefined |
| _descriptionHash | string | undefined |

### dispute

```solidity
function dispute(contract IHATClaimsManager _vault, bytes32 _claimId, uint256 _bondAmount, string _descriptionHash) external nonpayable
```

See {IHATArbitrator-dispute}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract IHATClaimsManager | undefined |
| _claimId | bytes32 | undefined |
| _bondAmount | uint256 | undefined |
| _descriptionHash | string | undefined |

### disputersBonds

```solidity
function disputersBonds(address, contract IHATClaimsManager, bytes32) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |
| _1 | contract IHATClaimsManager | undefined |
| _2 | bytes32 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### executeResolution

```solidity
function executeResolution(contract IHATClaimsManager _vault, bytes32 _claimId) external nonpayable
```

See {IHATArbitrator-executeResolution}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract IHATClaimsManager | undefined |
| _claimId | bytes32 | undefined |

### expertCommittee

```solidity
function expertCommittee() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### minBondAmount

```solidity
function minBondAmount() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### owner

```solidity
function owner() external view returns (address)
```



*Returns the address of the current owner.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### reclaimBond

```solidity
function reclaimBond(contract IHATClaimsManager _vault, bytes32 _claimId) external nonpayable
```

See {IHATArbitrator-reclaimBond}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract IHATClaimsManager | undefined |
| _claimId | bytes32 | undefined |

### refundDisputers

```solidity
function refundDisputers(contract IHATClaimsManager _vault, bytes32 _claimId, address[] _disputersToRefund) external nonpayable
```

See {IHATArbitrator-refundDisputers}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract IHATClaimsManager | undefined |
| _claimId | bytes32 | undefined |
| _disputersToRefund | address[] | undefined |

### refundExpiredSubmitClaimRequest

```solidity
function refundExpiredSubmitClaimRequest(bytes32 _internalClaimId) external nonpayable
```

See {IHATArbitrator-refundExpiredSubmitClaimRequest}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _internalClaimId | bytes32 | undefined |

### renounceOwnership

```solidity
function renounceOwnership() external nonpayable
```



*Leaves the contract without owner. It will not be possible to call `onlyOwner` functions anymore. Can only be called by the current owner. NOTE: Renouncing ownership will leave the contract without an owner, thereby removing any functionality that is only available to the owner.*


### resolutionChallengePeriod

```solidity
function resolutionChallengePeriod() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### resolutionChallengedAt

```solidity
function resolutionChallengedAt(contract IHATClaimsManager, bytes32) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | contract IHATClaimsManager | undefined |
| _1 | bytes32 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### resolutions

```solidity
function resolutions(contract IHATClaimsManager, bytes32) external view returns (address beneficiary, uint16 bountyPercentage, uint256 resolvedAt)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | contract IHATClaimsManager | undefined |
| _1 | bytes32 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| beneficiary | address | undefined |
| bountyPercentage | uint16 | undefined |
| resolvedAt | uint256 | undefined |

### setCourt

```solidity
function setCourt(address _court) external nonpayable
```

See {IHATArbitrator-setCourt}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _court | address | undefined |

### submitClaimRequest

```solidity
function submitClaimRequest(string _descriptionHash) external nonpayable
```

See {IHATArbitrator-submitClaimRequest}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _descriptionHash | string | undefined |

### submitClaimRequestReviewPeriod

```solidity
function submitClaimRequestReviewPeriod() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### submitClaimRequests

```solidity
function submitClaimRequests(bytes32) external view returns (address submitter, uint256 bond, uint256 submittedAt, string descriptionHash)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| submitter | address | undefined |
| bond | uint256 | undefined |
| submittedAt | uint256 | undefined |
| descriptionHash | string | undefined |

### token

```solidity
function token() external view returns (contract IERC20)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IERC20 | undefined |

### totalBondsOnClaim

```solidity
function totalBondsOnClaim(contract IHATClaimsManager, bytes32) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | contract IHATClaimsManager | undefined |
| _1 | bytes32 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### transferOwnership

```solidity
function transferOwnership(address newOwner) external nonpayable
```



*Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| newOwner | address | undefined |



## Events

### BondRefundClaimed

```solidity
event BondRefundClaimed(contract IHATClaimsManager indexed _vault, bytes32 indexed _claimId, address _disputer, uint256 _amountClaimed)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault `indexed` | contract IHATClaimsManager | undefined |
| _claimId `indexed` | bytes32 | undefined |
| _disputer  | address | undefined |
| _amountClaimed  | uint256 | undefined |

### ClaimDisputed

```solidity
event ClaimDisputed(contract IHATClaimsManager indexed _vault, bytes32 indexed _claimId, address indexed _disputer, uint256 _bondAmount, string _descriptionHash)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault `indexed` | contract IHATClaimsManager | undefined |
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
event DisputeAccepted(contract IHATClaimsManager indexed _vault, bytes32 indexed _claimId, uint16 _bountyPercentage, address _beneficiary, string _descriptionHash)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault `indexed` | contract IHATClaimsManager | undefined |
| _claimId `indexed` | bytes32 | undefined |
| _bountyPercentage  | uint16 | undefined |
| _beneficiary  | address | undefined |
| _descriptionHash  | string | undefined |

### DisputeDismissed

```solidity
event DisputeDismissed(contract IHATClaimsManager indexed _vault, bytes32 indexed _claimId, string _descriptionHash)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault `indexed` | contract IHATClaimsManager | undefined |
| _claimId `indexed` | bytes32 | undefined |
| _descriptionHash  | string | undefined |

### DisputersConfiscated

```solidity
event DisputersConfiscated(contract IHATClaimsManager indexed _vault, bytes32 indexed _claimId, address[] _disputers)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault `indexed` | contract IHATClaimsManager | undefined |
| _claimId `indexed` | bytes32 | undefined |
| _disputers  | address[] | undefined |

### DisputersRefunded

```solidity
event DisputersRefunded(contract IHATClaimsManager indexed _vault, bytes32 indexed _claimId, address[] _disputers)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault `indexed` | contract IHATClaimsManager | undefined |
| _claimId `indexed` | bytes32 | undefined |
| _disputers  | address[] | undefined |

### OwnershipTransferred

```solidity
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| previousOwner `indexed` | address | undefined |
| newOwner `indexed` | address | undefined |

### ResolutionChallenged

```solidity
event ResolutionChallenged(contract IHATClaimsManager indexed _vault, bytes32 indexed _claimId)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault `indexed` | contract IHATClaimsManager | undefined |
| _claimId `indexed` | bytes32 | undefined |

### ResolutionDismissed

```solidity
event ResolutionDismissed(contract IHATClaimsManager indexed _vault, bytes32 indexed _claimId)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault `indexed` | contract IHATClaimsManager | undefined |
| _claimId `indexed` | bytes32 | undefined |

### ResolutionExecuted

```solidity
event ResolutionExecuted(contract IHATClaimsManager indexed _vault, bytes32 indexed _claimId)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault `indexed` | contract IHATClaimsManager | undefined |
| _claimId `indexed` | bytes32 | undefined |

### SubmitClaimRequestApproved

```solidity
event SubmitClaimRequestApproved(bytes32 indexed _internalClaimId, bytes32 indexed _claimId, contract IHATClaimsManager indexed _vault)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _internalClaimId `indexed` | bytes32 | undefined |
| _claimId `indexed` | bytes32 | undefined |
| _vault `indexed` | contract IHATClaimsManager | undefined |

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







