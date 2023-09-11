# AutoAppealableArbitrator



> Auto Appealable Arbitrator



*This is a centralized arbitrator which either gives direct rulings or provides a time and fee for appeal.*

## Methods

### NOT_PAYABLE_VALUE

```solidity
function NOT_PAYABLE_VALUE() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

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
function appealCost(uint256 _disputeID, bytes) external view returns (uint256 fee)
```



*Cost of appeal. If appeal is not possible, it&#39;s a high value which can never be paid.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _disputeID | uint256 | ID of the dispute to be appealed. |
| _1 | bytes | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| fee | uint256 | Amount to be paid. |

### appealPeriod

```solidity
function appealPeriod(uint256 _disputeID) external view returns (uint256 start, uint256 end)
```



*Compute the start and end of the dispute&#39;s current or next appeal period, if possible.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _disputeID | uint256 | ID of the dispute. |

#### Returns

| Name | Type | Description |
|---|---|---|
| start | uint256 | The start of the period. |
| end | uint256 | The End of the period. |

### arbitrationCost

```solidity
function arbitrationCost(bytes) external view returns (uint256 fee)
```



*Cost of arbitration. Accessor to arbitrationPrice.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | bytes | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| fee | uint256 | Amount to be paid. |

### arbitrationPrice

```solidity
function arbitrationPrice() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### changeAppealFee

```solidity
function changeAppealFee(uint256 _disputeID, uint256 _appealCost) external nonpayable
```



*Change the appeal fee of a dispute.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _disputeID | uint256 | The ID of the dispute to update. |
| _appealCost | uint256 | The new cost to appeal this ruling. |

### createDispute

```solidity
function createDispute(uint256 _choices, bytes _extraData) external payable returns (uint256 disputeID)
```



*Create a dispute. Must be called by the arbitrable contract.  Must be paid at least arbitrationCost().*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _choices | uint256 | Amount of choices the arbitrator can make in this dispute. When ruling &lt;= choices. |
| _extraData | bytes | Can be used to give additional info on the dispute to be created. |

#### Returns

| Name | Type | Description |
|---|---|---|
| disputeID | uint256 | ID of the dispute created. |

### currentRuling

```solidity
function currentRuling(uint256 _disputeID) external view returns (uint256 ruling)
```



*Return the ruling of a dispute.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _disputeID | uint256 | ID of the dispute. |

#### Returns

| Name | Type | Description |
|---|---|---|
| ruling | uint256 | The ruling which have been given or which would be given if no appeals are raised. |

### disputeStatus

```solidity
function disputeStatus(uint256 _disputeID) external view returns (enum IArbitrator.DisputeStatus status)
```



*Return the status of a dispute (in the sense of ERC792, not the Dispute property).*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _disputeID | uint256 | ID of the dispute to rule. |

#### Returns

| Name | Type | Description |
|---|---|---|
| status | enum IArbitrator.DisputeStatus | The status of the dispute. |

### disputes

```solidity
function disputes(uint256) external view returns (contract IArbitrable arbitrated, uint256 choices, uint256 fees, uint256 ruling, enum IArbitrator.DisputeStatus status, uint256 appealCost, uint256 appealPeriodStart, uint256 appealPeriodEnd)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| arbitrated | contract IArbitrable | undefined |
| choices | uint256 | undefined |
| fees | uint256 | undefined |
| ruling | uint256 | undefined |
| status | enum IArbitrator.DisputeStatus | undefined |
| appealCost | uint256 | undefined |
| appealPeriodStart | uint256 | undefined |
| appealPeriodEnd | uint256 | undefined |

### executeRuling

```solidity
function executeRuling(uint256 _disputeID) external nonpayable
```



*Execute the ruling of a dispute after the appeal period has passed. UNTRUSTED.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _disputeID | uint256 | ID of the dispute to execute. |

### giveAppealableRuling

```solidity
function giveAppealableRuling(uint256 _disputeID, uint256 _ruling, uint256 _appealCost, uint256 _timeToAppeal) external nonpayable
```



*Give an appealable ruling.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _disputeID | uint256 | ID of the dispute to rule. |
| _ruling | uint256 | Ruling given by the arbitrator. Note that 0 means &quot;Not able/wanting to make a decision&quot;. |
| _appealCost | uint256 | The cost of appeal. |
| _timeToAppeal | uint256 | The time to appeal the ruling. |

### giveRuling

```solidity
function giveRuling(uint256 _disputeID, uint256 _ruling) external nonpayable
```



*Give a ruling. UNTRUSTED.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _disputeID | uint256 | ID of the dispute to rule. |
| _ruling | uint256 | Ruling given by the arbitrator. Note that 0 means &quot;Not able/wanting to make a decision&quot;. |

### owner

```solidity
function owner() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### setArbitrationPrice

```solidity
function setArbitrationPrice(uint256 _arbitrationPrice) external nonpayable
```



*Set the arbitration price. Only callable by the owner.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _arbitrationPrice | uint256 | Amount to be paid for arbitration. |



## Events

### AppealDecision

```solidity
event AppealDecision(uint256 indexed _disputeID, contract IArbitrable indexed _arbitrable)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _disputeID `indexed` | uint256 | undefined |
| _arbitrable `indexed` | contract IArbitrable | undefined |

### AppealPossible

```solidity
event AppealPossible(uint256 indexed _disputeID, contract IArbitrable indexed _arbitrable)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _disputeID `indexed` | uint256 | undefined |
| _arbitrable `indexed` | contract IArbitrable | undefined |

### DisputeCreation

```solidity
event DisputeCreation(uint256 indexed _disputeID, contract IArbitrable indexed _arbitrable)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _disputeID `indexed` | uint256 | undefined |
| _arbitrable `indexed` | contract IArbitrable | undefined |



