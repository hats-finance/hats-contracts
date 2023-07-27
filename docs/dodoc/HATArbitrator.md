# HATArbitrator









## Methods

### acceptDispute

```solidity
function acceptDispute(contract IHATVault _vault, bytes32 _claimId, uint16 _bountyPercentage, address _beneficiary, address[] _disputersToRefund, address[] _disputersToConfiscate, string _descriptionHash) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract IHATVault | undefined |
| _claimId | bytes32 | undefined |
| _bountyPercentage | uint16 | undefined |
| _beneficiary | address | undefined |
| _disputersToRefund | address[] | undefined |
| _disputersToConfiscate | address[] | undefined |
| _descriptionHash | string | undefined |

### approveSubmitClaimRequest

```solidity
function approveSubmitClaimRequest(contract IHATVault _vault, bytes32 _internalClaimId, address _beneficiary, uint16 _bountyPercentage, string _descriptionHash) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract IHATVault | undefined |
| _internalClaimId | bytes32 | undefined |
| _beneficiary | address | undefined |
| _bountyPercentage | uint16 | undefined |
| _descriptionHash | string | undefined |

### bondClaimable

```solidity
function bondClaimable(address, contract IHATVault, bytes32) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |
| _1 | contract IHATVault | undefined |
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
function challengeResolution(contract IHATVault _vault, bytes32 _claimId) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract IHATVault | undefined |
| _claimId | bytes32 | undefined |

### confiscateDisputers

```solidity
function confiscateDisputers(contract IHATVault _vault, bytes32 _claimId, address[] _disputersToConfiscate) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract IHATVault | undefined |
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
function dismissDispute(contract IHATVault _vault, bytes32 _claimId, string _descriptionHash) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract IHATVault | undefined |
| _claimId | bytes32 | undefined |
| _descriptionHash | string | undefined |

### dismissResolution

```solidity
function dismissResolution(contract IHATVault _vault, bytes32 _claimId) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract IHATVault | undefined |
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
function dispute(contract IHATVault _vault, bytes32 _claimId, uint256 _bondAmount, string _descriptionHash) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract IHATVault | undefined |
| _claimId | bytes32 | undefined |
| _bondAmount | uint256 | undefined |
| _descriptionHash | string | undefined |

### disputersBonds

```solidity
function disputersBonds(address, contract IHATVault, bytes32) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |
| _1 | contract IHATVault | undefined |
| _2 | bytes32 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### executeResolution

```solidity
function executeResolution(contract IHATVault _vault, bytes32 _claimId) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract IHATVault | undefined |
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
function refundBond(contract IHATVault _vault, bytes32 _claimId) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract IHATVault | undefined |
| _claimId | bytes32 | undefined |

### refundDisputers

```solidity
function refundDisputers(contract IHATVault _vault, bytes32 _claimId, address[] _disputersToRefund) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract IHATVault | undefined |
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
function resolutionChallengedAt(contract IHATVault, bytes32) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | contract IHATVault | undefined |
| _1 | bytes32 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### resolutions

```solidity
function resolutions(contract IHATVault, bytes32) external view returns (address beneficiary, uint16 bountyPercentage, uint256 resolvedAt)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | contract IHATVault | undefined |
| _1 | bytes32 | undefined |

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
function totalBondsOnClaim(contract IHATVault, bytes32) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | contract IHATVault | undefined |
| _1 | bytes32 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |



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







