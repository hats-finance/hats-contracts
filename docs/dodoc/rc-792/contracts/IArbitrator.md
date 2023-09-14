# IArbitrator



> Arbitrator Arbitrator abstract contract. When developing arbitrator contracts we need to: - Define the functions for dispute creation (createDispute) and appeal (appeal). Don&#39;t forget to store the arbitrated contract and the disputeID (which should be unique, may nbDisputes). - Define the functions for cost display (arbitrationCost and appealCost). - Allow giving rulings. For this a function must call arbitrable.rule(disputeID, ruling).





## Methods

### appeal

```solidity
function appeal(uint256 _disputeID, bytes _extraData) external payable
```



*Appeal a ruling. Note that it has to be called before the arbitrator contract calls rule.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _disputeID | uint256 | ID of the dispute to be appealed. |
| _extraData | bytes | Can be used to give extra info on the appeal. |

### appealCost

```solidity
function appealCost(uint256 _disputeID, bytes _extraData) external view returns (uint256 cost)
```



*Compute the cost of appeal. It is recommended not to increase it often, as it can be higly time and gas consuming for the arbitrated contracts to cope with fee augmentation.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _disputeID | uint256 | ID of the dispute to be appealed. |
| _extraData | bytes | Can be used to give additional info on the dispute to be created. |

#### Returns

| Name | Type | Description |
|---|---|---|
| cost | uint256 | Amount to be paid. |

### appealPeriod

```solidity
function appealPeriod(uint256 _disputeID) external view returns (uint256 start, uint256 end)
```



*Compute the start and end of the dispute&#39;s current or next appeal period, if possible. If not known or appeal is impossible: should return (0, 0).*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _disputeID | uint256 | ID of the dispute. |

#### Returns

| Name | Type | Description |
|---|---|---|
| start | uint256 | The start of the period. |
| end | uint256 | The end of the period. |

### arbitrationCost

```solidity
function arbitrationCost(bytes _extraData) external view returns (uint256 cost)
```



*Compute the cost of arbitration. It is recommended not to increase it often, as it can be highly time and gas consuming for the arbitrated contracts to cope with fee augmentation.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _extraData | bytes | Can be used to give additional info on the dispute to be created. |

#### Returns

| Name | Type | Description |
|---|---|---|
| cost | uint256 | Amount to be paid. |

### createDispute

```solidity
function createDispute(uint256 _choices, bytes _extraData) external payable returns (uint256 disputeID)
```



*Create a dispute. Must be called by the arbitrable contract. Must be paid at least arbitrationCost(_extraData).*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _choices | uint256 | Amount of choices the arbitrator can make in this dispute. |
| _extraData | bytes | Can be used to give additional info on the dispute to be created. |

#### Returns

| Name | Type | Description |
|---|---|---|
| disputeID | uint256 | ID of the dispute created. |

### currentRuling

```solidity
function currentRuling(uint256 _disputeID) external view returns (uint256 ruling)
```



*Return the current ruling of a dispute. This is useful for parties to know if they should appeal.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _disputeID | uint256 | ID of the dispute. |

#### Returns

| Name | Type | Description |
|---|---|---|
| ruling | uint256 | The ruling which has been given or the one which will be given if there is no appeal. |

### disputeStatus

```solidity
function disputeStatus(uint256 _disputeID) external view returns (enum IArbitrator.DisputeStatus status)
```



*Return the status of a dispute.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _disputeID | uint256 | ID of the dispute to rule. |

#### Returns

| Name | Type | Description |
|---|---|---|
| status | enum IArbitrator.DisputeStatus | The status of the dispute. |



## Events

### AppealDecision

```solidity
event AppealDecision(uint256 indexed _disputeID, contract IArbitrable indexed _arbitrable)
```



*To be emitted when the current ruling is appealed.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _disputeID `indexed` | uint256 | ID of the dispute. |
| _arbitrable `indexed` | contract IArbitrable | The contract which created the dispute. |

### AppealPossible

```solidity
event AppealPossible(uint256 indexed _disputeID, contract IArbitrable indexed _arbitrable)
```



*To be emitted when a dispute can be appealed.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _disputeID `indexed` | uint256 | ID of the dispute. |
| _arbitrable `indexed` | contract IArbitrable | The contract which created the dispute. |

### DisputeCreation

```solidity
event DisputeCreation(uint256 indexed _disputeID, contract IArbitrable indexed _arbitrable)
```



*To be emitted when a dispute is created.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _disputeID `indexed` | uint256 | ID of the dispute. |
| _arbitrable `indexed` | contract IArbitrable | The contract which created the dispute. |



