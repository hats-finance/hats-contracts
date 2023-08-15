# HATKlerosV2Connector



> HATKlerosV2Connector



*This contract acts a connector between HatsFinance and Kleros court V2. The contract doesn&#39;t support appeals and evidence  submisstion, since it&#39;ll be handled by the court.*

## Methods

### arbitratorExtraData

```solidity
function arbitratorExtraData() external view returns (bytes)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes | undefined |

### claimChallenged

```solidity
function claimChallenged(bytes32) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### disputes

```solidity
function disputes(uint256) external view returns (bytes32 claimId, uint256 externalDisputeId, enum IHATKlerosConnector.Decision ruling, bool resolved, contract IHATVault vault)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| claimId | bytes32 | undefined |
| externalDisputeId | uint256 | undefined |
| ruling | enum IHATKlerosConnector.Decision | undefined |
| resolved | bool | undefined |
| vault | contract IHATVault | undefined |

### externalIDtoLocalID

```solidity
function externalIDtoLocalID(uint256) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### getArbitrationCost

```solidity
function getArbitrationCost() external view returns (uint256)
```



*Get the arbitration cost to challenge a claim.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | Arbitration cost. |

### hatArbitrator

```solidity
function hatArbitrator() external view returns (contract HATArbitrator)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract HATArbitrator | undefined |

### klerosArbitrator

```solidity
function klerosArbitrator() external view returns (contract IArbitrator)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IArbitrator | undefined |

### notifyArbitrator

```solidity
function notifyArbitrator(bytes32 _claimId, string _evidence, contract IHATVault _vault, address _disputer) external payable
```



*Notify KlerosArbitrator that expert&#39;s committee decision was challenged. Can only be called by Hat arbitrator.  Requires the arbitration fees to be paid.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId | bytes32 | The Id of the active claim in Vault contract. |
| _evidence | string | URI of the evidence to support the challenge. |
| _vault | contract IHATVault | Relevant vault address. |
| _disputer | address | Address that made the challenge.  Note that the validity of the claim should be checked by Hat arbitrator. |

### rule

```solidity
function rule(uint256 _disputeId, uint256 _ruling) external nonpayable
```



*Give a ruling for a dispute. Can only be called by the Kleros arbitrator.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _disputeId | uint256 | ID of the dispute in the Kleros arbitrator contract. |
| _ruling | uint256 | Ruling given by the arbitrator. Note that 0 is reserved for &quot;Refused to arbitrate&quot;. |



## Events

### Challenged

```solidity
event Challenged(bytes32 indexed _claimId)
```



*Raised when a claim is challenged.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId `indexed` | bytes32 | Id of the claim in Vault cotract. |

### Ruling

```solidity
event Ruling(contract IArbitrator indexed _arbitrator, uint256 indexed _disputeID, uint256 _ruling)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _arbitrator `indexed` | contract IArbitrator | undefined |
| _disputeID `indexed` | uint256 | undefined |
| _ruling  | uint256 | undefined |



