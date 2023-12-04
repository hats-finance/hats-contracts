# BadKlerosConnectorEthReceiver









## Methods

### challengeResolution

```solidity
function challengeResolution(contract IHATArbitrator _arbitrator, contract IHATClaimsManager _vault, bytes32 _claimId, string _evidence) external payable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _arbitrator | contract IHATArbitrator | undefined |
| _vault | contract IHATClaimsManager | undefined |
| _claimId | bytes32 | undefined |
| _evidence | string | undefined |

### fundAppeal

```solidity
function fundAppeal(contract HATKlerosConnector _connector, uint256 _localDisputeId, uint256 _side) external payable returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _connector | contract HATKlerosConnector | undefined |
| _localDisputeId | uint256 | undefined |
| _side | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### setShouldFail

```solidity
function setShouldFail(bool _shouldFail) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _shouldFail | bool | undefined |

### shouldFail

```solidity
function shouldFail() external view returns (bool)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |




