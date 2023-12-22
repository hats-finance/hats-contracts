# HatVaultForConnectorMock









## Methods

### CHALLENGE_TIMEOUT_PERIOD

```solidity
function CHALLENGE_TIMEOUT_PERIOD() external view returns (uint32)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint32 | undefined |

### MAX_BOUNTY_LIMIT

```solidity
function MAX_BOUNTY_LIMIT() external view returns (uint16)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint16 | undefined |

### activeClaim

```solidity
function activeClaim() external view returns (bytes32 claimId, address beneficiary, uint16 bountyPercentage, address committee, uint32 createdAt, uint32 challengedAt, uint256 governanceFee, address arbitrator, uint32 challengePeriod, uint32 challengeTimeOutPeriod, bool arbitratorCanChangeBounty, bool arbitratorCanChangeBeneficiary)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| claimId | bytes32 | undefined |
| beneficiary | address | undefined |
| bountyPercentage | uint16 | undefined |
| committee | address | undefined |
| createdAt | uint32 | undefined |
| challengedAt | uint32 | undefined |
| governanceFee | uint256 | undefined |
| arbitrator | address | undefined |
| challengePeriod | uint32 | undefined |
| challengeTimeOutPeriod | uint32 | undefined |
| arbitratorCanChangeBounty | bool | undefined |
| arbitratorCanChangeBeneficiary | bool | undefined |

### approveClaim

```solidity
function approveClaim(bytes32 _claimId, uint16 _bountyPercentage, address _beneficiary) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId | bytes32 | undefined |
| _bountyPercentage | uint16 | undefined |
| _beneficiary | address | undefined |

### arbitrator

```solidity
function arbitrator() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### challengeClaim

```solidity
function challengeClaim(bytes32 _claimId) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId | bytes32 | undefined |

### challengePeriod

```solidity
function challengePeriod() external view returns (uint32)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint32 | undefined |

### dismissClaim

```solidity
function dismissClaim(bytes32 _claimId) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId | bytes32 | undefined |

### getActiveClaim

```solidity
function getActiveClaim() external view returns (struct HatVaultForConnectorMock.Claim)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | HatVaultForConnectorMock.Claim | undefined |

### nonce

```solidity
function nonce() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### setArbitrator

```solidity
function setArbitrator(address _arbitrator) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _arbitrator | address | undefined |

### submitClaim

```solidity
function submitClaim(address _beneficiary, uint16 _bountyPercentage, string _descriptionHash) external nonpayable returns (bytes32 claimId)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _beneficiary | address | undefined |
| _bountyPercentage | uint16 | undefined |
| _descriptionHash | string | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| claimId | bytes32 | undefined |



## Events

### ApproveClaim

```solidity
event ApproveClaim(bytes32 _claimId, address _sender, address _beneficiary, uint256 _bountyPercentage)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId  | bytes32 | undefined |
| _sender  | address | undefined |
| _beneficiary  | address | undefined |
| _bountyPercentage  | uint256 | undefined |

### ChallengeClaim

```solidity
event ChallengeClaim(bytes32 indexed _claimId)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId `indexed` | bytes32 | undefined |

### DismissClaim

```solidity
event DismissClaim(bytes32 indexed _claimId)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId `indexed` | bytes32 | undefined |

### SubmitClaim

```solidity
event SubmitClaim(bytes32 _claimId, address _submitter, address _beneficiary, uint256 _bountyPercentage, string _descriptionHash)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId  | bytes32 | undefined |
| _submitter  | address | undefined |
| _beneficiary  | address | undefined |
| _bountyPercentage  | uint256 | undefined |
| _descriptionHash  | string | undefined |



