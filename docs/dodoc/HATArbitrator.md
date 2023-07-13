# HATArbitrator









## Methods

### acceptDispute

```solidity
function acceptDispute(bytes32 _claimId, uint16 _bountyPercentage, address _beneficiary) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId | bytes32 | undefined |
| _bountyPercentage | uint16 | undefined |
| _beneficiary | address | undefined |

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
function dismissDispute(bytes32 _claimId) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId | bytes32 | undefined |

### dispute

```solidity
function dispute(bytes32 _claimId, bytes32 _ipfsHash, uint256 _bondAmount) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId | bytes32 | undefined |
| _ipfsHash | bytes32 | undefined |
| _bondAmount | uint256 | undefined |

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

### ClaimDisputed

```solidity
event ClaimDisputed(bytes32 indexed _claimId, address indexed _disputer, bytes32 _ipfsHash, uint256 _bondAmount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId `indexed` | bytes32 | undefined |
| _disputer `indexed` | address | undefined |
| _ipfsHash  | bytes32 | undefined |
| _bondAmount  | uint256 | undefined |



## Errors

### AlreadyResolved

```solidity
error AlreadyResolved()
```






### BondAmountSubmittedTooLow

```solidity
error BondAmountSubmittedTooLow()
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






### ResolutionWasChallenged

```solidity
error ResolutionWasChallenged()
```






### bondsNeededToStartDisputeMustBeHigherThanMinAmount

```solidity
error bondsNeededToStartDisputeMustBeHigherThanMinAmount()
```







