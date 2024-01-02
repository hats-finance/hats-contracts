# IEvidence



> IEvidence  ERC-1497: Evidence Standard






## Events

### Dispute

```solidity
event Dispute(contract IArbitrator indexed _arbitrator, uint256 indexed _disputeID, uint256 _metaEvidenceID, uint256 _evidenceGroupID)
```



*To be emitted when a dispute is created to link the correct meta-evidence to the disputeID.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _arbitrator `indexed` | contract IArbitrator | The arbitrator of the contract. |
| _disputeID `indexed` | uint256 | ID of the dispute in the Arbitrator contract. |
| _metaEvidenceID  | uint256 | Unique identifier of meta-evidence. |
| _evidenceGroupID  | uint256 | Unique identifier of the evidence group that is linked to this dispute. |

### Evidence

```solidity
event Evidence(contract IArbitrator indexed _arbitrator, uint256 indexed _evidenceGroupID, address indexed _party, string _evidence)
```



*To be raised when evidence is submitted. Should point to the resource (evidences are not to be stored on chain due to gas considerations).*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _arbitrator `indexed` | contract IArbitrator | The arbitrator of the contract. |
| _evidenceGroupID `indexed` | uint256 | Unique identifier of the evidence group the evidence belongs to. |
| _party `indexed` | address | The address of the party submiting the evidence. Note that 0x0 refers to evidence not submitted by any party. |
| _evidence  | string | IPFS path to evidence, example: &#39;/ipfs/Qmarwkf7C9RuzDEJNnarT3WZ7kem5bk8DZAzx78acJjMFH/evidence.json&#39; |

### MetaEvidence

```solidity
event MetaEvidence(uint256 indexed _metaEvidenceID, string _evidence)
```



*To be emitted when meta-evidence is submitted.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _metaEvidenceID `indexed` | uint256 | Unique identifier of meta-evidence. |
| _evidence  | string | IPFS path to metaevidence, example: &#39;/ipfs/Qmarwkf7C9RuzDEJNnarT3WZ7kem5bk8DZAzx78acJjMFH/metaevidence.json&#39; |



