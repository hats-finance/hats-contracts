# IArbitrable



> IArbitrable Arbitrable interface. When developing arbitrable contracts, we need to: - Define the action taken when a ruling is received by the contract. - Allow dispute creation. For this a function must call arbitrator.createDispute{value: _fee}(_choices,_extraData);





## Methods

### rule

```solidity
function rule(uint256 _disputeID, uint256 _ruling) external nonpayable
```



*Give a ruling for a dispute. Must be called by the arbitrator. The purpose of this function is to ensure that the address calling it has the right to rule on the contract.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _disputeID | uint256 | ID of the dispute in the Arbitrator contract. |
| _ruling | uint256 | Ruling given by the arbitrator. Note that 0 is reserved for &quot;Not able/wanting to make a decision&quot;. |



## Events

### Ruling

```solidity
event Ruling(contract IArbitrator indexed _arbitrator, uint256 indexed _disputeID, uint256 _ruling)
```



*To be raised when a ruling is given.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _arbitrator `indexed` | contract IArbitrator | The arbitrator giving the ruling. |
| _disputeID `indexed` | uint256 | ID of the dispute in the Arbitrator contract. |
| _ruling  | uint256 | The ruling which was given. |



