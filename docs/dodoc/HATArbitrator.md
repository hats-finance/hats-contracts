# HATArbitrator









## Methods

### acceptDispute

```solidity
function acceptDispute(bytes32 _claimId, uint16 _bountyPercentage, address _beneficiary, address[] _disputersToRefund, string _descriptionHash) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId | bytes32 | undefined |
| _bountyPercentage | uint16 | undefined |
| _beneficiary | address | undefined |
| _disputersToRefund | address[] | undefined |
| _descriptionHash | string | undefined |

### approveSubmitClaimRequest

```solidity
function approveSubmitClaimRequest(bytes32 _internalClaimId, address _beneficiary, uint16 _bountyPercentage, string _descriptionHash) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _internalClaimId | bytes32 | undefined |
| _beneficiary | address | undefined |
| _bountyPercentage | uint16 | undefined |
| _descriptionHash | string | undefined |

### bondClaimable

```solidity
function bondClaimable(address, bytes32) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |
| _1 | bytes32 | undefined |

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
function challengeResolution(bytes32 _claimId) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId | bytes32 | undefined |

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
function dismissDispute(bytes32 _claimId, string _descriptionHash) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId | bytes32 | undefined |
| _descriptionHash | string | undefined |

### dismissResolution

```solidity
function dismissResolution(bytes32 _claimId) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId | bytes32 | undefined |

### dismissSubmitClaimRequest

```solidity
function dismissSubmitClaimRequest(bytes32 _internalClaimId, string _descriptionHash) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _internalClaimId | bytes32 | undefined |
| _descriptionHash | string | undefined |

### dispute

```solidity
function dispute(bytes32 _claimId, uint256 _bondAmount, string _descriptionHash) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId | bytes32 | undefined |
| _bondAmount | uint256 | undefined |
| _descriptionHash | string | undefined |

### disputersBonds

```solidity
function disputersBonds(address, bytes32) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |
| _1 | bytes32 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### executeResolution

```solidity
function executeResolution(bytes32 _claimId) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
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

### refundBond

```solidity
function refundBond(bytes32 _claimId) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId | bytes32 | undefined |

### refundDisputers

```solidity
function refundDisputers(bytes32 _claimId, address[] _disputersToRefund) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId | bytes32 | undefined |
| _disputersToRefund | address[] | undefined |

### refundExpiredSubmitClaimRequest

```solidity
function refundExpiredSubmitClaimRequest(bytes32 _internalClaimId) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _internalClaimId | bytes32 | undefined |

### resolutionChallegPeriod

```solidity
function resolutionChallegPeriod() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### resolutionChallengedAt

```solidity
function resolutionChallengedAt(bytes32) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### resolutions

```solidity
function resolutions(bytes32) external view returns (address beneficiary, uint16 bountyPercentage, uint256 resolvedAt)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| beneficiary | address | undefined |
| bountyPercentage | uint16 | undefined |
| resolvedAt | uint256 | undefined |

### submitClaimRequest

```solidity
function submitClaimRequest(string _descriptionHash) external nonpayable
```





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
function totalBondsOnClaim(bytes32) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### vault

```solidity
function vault() external view returns (contract IHATVault)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IHATVault | undefined |



## Events

### BondRefundClaimed

```solidity
event BondRefundClaimed(bytes32 indexed _claimId, address _disputer)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId `indexed` | bytes32 | undefined |
| _disputer  | address | undefined |

### ClaimDisputed

```solidity
event ClaimDisputed(bytes32 indexed _claimId, address indexed _disputer, uint256 _bondAmount, string _descriptionHash)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId `indexed` | bytes32 | undefined |
| _disputer `indexed` | address | undefined |
| _bondAmount  | uint256 | undefined |
| _descriptionHash  | string | undefined |

### DisputeAccepted

```solidity
event DisputeAccepted(bytes32 indexed _claimId, uint16 _bountyPercentage, address _beneficiary, string _descriptionHash)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId `indexed` | bytes32 | undefined |
| _bountyPercentage  | uint16 | undefined |
| _beneficiary  | address | undefined |
| _descriptionHash  | string | undefined |

### DisputeDismissed

```solidity
event DisputeDismissed(bytes32 indexed _claimId, string _descriptionHash)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId `indexed` | bytes32 | undefined |
| _descriptionHash  | string | undefined |

### DisputersRefunded

```solidity
event DisputersRefunded(bytes32 indexed _claimId, address[] _disputers)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId `indexed` | bytes32 | undefined |
| _disputers  | address[] | undefined |

### ResolutionChallenged

```solidity
event ResolutionChallenged(bytes32 indexed _claimId)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId `indexed` | bytes32 | undefined |

### ResolutionDismissed

```solidity
event ResolutionDismissed(bytes32 indexed _claimId)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId `indexed` | bytes32 | undefined |

### ResolutionExecuted

```solidity
event ResolutionExecuted(bytes32 indexed _claimId)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId `indexed` | bytes32 | undefined |

### SubmitClaimRequestApproved

```solidity
event SubmitClaimRequestApproved(bytes32 indexed _internalClaimId, bytes32 indexed _claimId)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _internalClaimId `indexed` | bytes32 | undefined |
| _claimId `indexed` | bytes32 | undefined |

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

### AlreadyResolved

```solidity
error AlreadyResolved()
```






### BondAmountSubmittedTooLow

```solidity
error BondAmountSubmittedTooLow()
```






### CallerIsNotSubmitter

```solidity
error CallerIsNotSubmitter()
```






### CanOnlyBeCalledByCourt

```solidity
error CanOnlyBeCalledByCourt()
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






### ClaimDisputedIsNotCurrentlyActiveClaim

```solidity
error ClaimDisputedIsNotCurrentlyActiveClaim()
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






### NoResolution

```solidity
error NoResolution()
```






### NoResolutionExistsForClaim

```solidity
error NoResolutionExistsForClaim()
```






### OnlyExpertCommittee

```solidity
error OnlyExpertCommittee()
```






### bondsNeededToStartDisputeMustBeHigherThanMinAmount

```solidity
error bondsNeededToStartDisputeMustBeHigherThanMinAmount()
```







