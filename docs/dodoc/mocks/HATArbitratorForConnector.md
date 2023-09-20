# HATArbitratorForConnector









## Methods

### acceptDispute

```solidity
function acceptDispute(contract IHATClaimsManager _vault, bytes32 _claimId, uint16 _bountyPercentage, address _beneficiary) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract IHATClaimsManager | undefined |
| _claimId | bytes32 | undefined |
| _bountyPercentage | uint16 | undefined |
| _beneficiary | address | undefined |

### challengeResolution

```solidity
function challengeResolution(contract IHATClaimsManager _vault, bytes32 _claimId, string _evidence) external payable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract IHATClaimsManager | undefined |
| _claimId | bytes32 | undefined |
| _evidence | string | undefined |

### court

```solidity
function court() external view returns (contract IHATKlerosConnector)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IHATKlerosConnector | undefined |

### dismissResolution

```solidity
function dismissResolution(contract IHATClaimsManager _vault, bytes32 _claimId) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract IHATClaimsManager | undefined |
| _claimId | bytes32 | undefined |

### dispute

```solidity
function dispute(contract IHATClaimsManager _vault, bytes32 _claimId) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract IHATClaimsManager | undefined |
| _claimId | bytes32 | undefined |

### executeResolution

```solidity
function executeResolution(contract IHATClaimsManager _vault, bytes32 _claimId) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract IHATClaimsManager | undefined |
| _claimId | bytes32 | undefined |

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
function setCourt(contract IHATKlerosConnector _court) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _court | contract IHATKlerosConnector | undefined |




