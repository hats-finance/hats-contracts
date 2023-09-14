# HATKlerosConnectorMock









## Methods

### VERSION

```solidity
function VERSION() external view returns (string)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | string | undefined |

### arbitratorExtraData

```solidity
function arbitratorExtraData() external view returns (bytes)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes | undefined |

### changeLoserMultiplier

```solidity
function changeLoserMultiplier(uint256 _loserMultiplier) external nonpayable
```



*Changes loserMultiplier variable.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _loserMultiplier | uint256 | The new winnerMultiplier value. |

### changeMetaEvidence

```solidity
function changeMetaEvidence(string _metaEvidence) external nonpayable
```



*Update the meta evidence used for disputes.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _metaEvidence | string | URI of the new meta evidence. |

### changeWinnerMultiplier

```solidity
function changeWinnerMultiplier(uint256 _winnerMultiplier) external nonpayable
```



*Changes winnerMultiplier variable.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _winnerMultiplier | uint256 | The new winnerMultiplier value. |

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

### dismissResolution

```solidity
function dismissResolution(contract IHATArbitrator _arbitrator, contract IHATVault _vault, bytes32 _claimId) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _arbitrator | contract IHATArbitrator | undefined |
| _vault | contract IHATVault | undefined |
| _claimId | bytes32 | undefined |

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

### executeResolution

```solidity
function executeResolution(contract IHATArbitrator _arbitrator, contract IHATVault _vault, bytes32 _claimId) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _arbitrator | contract IHATArbitrator | undefined |
| _vault | contract IHATVault | undefined |
| _claimId | bytes32 | undefined |

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

### fundAppeal

```solidity
function fundAppeal(uint256 _localDisputeId, uint256 _side) external payable returns (bool)
```



*Takes up to the total amount required to fund a side. Reimburses the rest. Creates an appeal if both sides are fully funded.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _localDisputeId | uint256 | The ID of the local dispute. |
| _side | uint256 | The option to fund. 0 - refuse to rule, 1 - make no changes, 2 - side with challenger. |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | fullyFunded Whether the side was fully funded or not. |

### getArbitrationCost

```solidity
function getArbitrationCost() external view returns (uint256)
```



*Get the arbitration cost to challenge a claim.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | Arbitration cost. |

### getContributions

```solidity
function getContributions(uint256 _localDisputeId, uint256 _round, address _contributor) external view returns (uint256[3] contributions)
```



*Gets the contributions made by a party for a given round of a dispute.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _localDisputeId | uint256 | The ID of the dispute. |
| _round | uint256 | The round to query. |
| _contributor | address | The address of the contributor. |

#### Returns

| Name | Type | Description |
|---|---|---|
| contributions | uint256[3] | The contributions. |

### getMultipliers

```solidity
function getMultipliers() external view returns (uint256 winner, uint256 loser, uint256 loserAppealPeriod, uint256 divisor)
```



*Returns stake multipliers.*


#### Returns

| Name | Type | Description |
|---|---|---|
| winner | uint256 | Winners stake multiplier. |
| loser | uint256 | Losers stake multiplier. |
| loserAppealPeriod | uint256 | Multiplier for calculating an appeal period duration for the losing side. |
| divisor | uint256 | Multiplier divisor. |

### getNumberOfRounds

```solidity
function getNumberOfRounds(uint256 _localDisputeId) external view returns (uint256)
```



*Gets the number of rounds of the specific dispute.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _localDisputeId | uint256 | The ID of the dispute. |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | The number of rounds. |

### getRoundInfo

```solidity
function getRoundInfo(uint256 _localDisputeId, uint256 _round) external view returns (uint256[3] paidFees, bool[3] hasPaid, uint256 feeRewards, uint256[] fundedSides)
```



*Gets the information of a round of a dispute.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _localDisputeId | uint256 | The ID of the dispute. |
| _round | uint256 | The round to query. |

#### Returns

| Name | Type | Description |
|---|---|---|
| paidFees | uint256[3] | The amount of fees paid for each side. |
| hasPaid | bool[3] | True if the side is fully funded |
| feeRewards | uint256 | The amount of fees that will be used as rewards. |
| fundedSides | uint256[] | Fully funded sides. |

### getTotalWithdrawableAmount

```solidity
function getTotalWithdrawableAmount(uint256 _localDisputeId, address payable _beneficiary, uint256 _contributedTo) external view returns (uint256 sum)
```



*Returns the sum of withdrawable amount.This function is O(n) where n is the total number of rounds.This could exceed the gas limit, therefore this function should be used only as a utility and not be relied upon by other contracts.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _localDisputeId | uint256 | The ID of the dispute. |
| _beneficiary | address payable | The contributor for which to query. |
| _contributedTo | uint256 | Side that received contributions from contributor. |

#### Returns

| Name | Type | Description |
|---|---|---|
| sum | uint256 | The total amount available to withdraw. |

### hatArbitrator

```solidity
function hatArbitrator() external view returns (contract IHATArbitrator)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IHATArbitrator | undefined |

### klerosArbitrator

```solidity
function klerosArbitrator() external view returns (contract IArbitrator)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IArbitrator | undefined |

### loserAppealPeriodMultiplier

```solidity
function loserAppealPeriodMultiplier() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### loserMultiplier

```solidity
function loserMultiplier() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### metaEvidenceUpdates

```solidity
function metaEvidenceUpdates() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

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

### numberOfRulingOptions

```solidity
function numberOfRulingOptions(uint256) external pure returns (uint256)
```



*Returns number of possible ruling options. Valid rulings are [0, return value].*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | count The number of ruling options. |

### owner

```solidity
function owner() external view returns (address)
```



*Returns the address of the current owner.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### renounceOwnership

```solidity
function renounceOwnership() external nonpayable
```



*Leaves the contract without owner. It will not be possible to call `onlyOwner` functions anymore. Can only be called by the current owner. NOTE: Renouncing ownership will leave the contract without an owner, thereby removing any functionality that is only available to the owner.*


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

### submitEvidence

```solidity
function submitEvidence(uint256 _localDisputeId, string _evidenceURI) external nonpayable
```



*Submit a reference to evidence. EVENT.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _localDisputeId | uint256 | The id of the related dispute. |
| _evidenceURI | string | Link to evidence. |

### transferOwnership

```solidity
function transferOwnership(address newOwner) external nonpayable
```



*Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| newOwner | address | undefined |

### winnerMultiplier

```solidity
function winnerMultiplier() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### withdrawFeesAndRewards

```solidity
function withdrawFeesAndRewards(uint256 _localDisputeId, address payable _beneficiary, uint256 _round, uint256 _side) external nonpayable returns (uint256 reward)
```



*Sends the fee stake rewards and reimbursements proportional to the contributions made to the winner of a dispute. Reimburses contributions if there is no winner.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _localDisputeId | uint256 | The ID of the related dispute. |
| _beneficiary | address payable | The address to send reward to. |
| _round | uint256 | The round from which to withdraw. |
| _side | uint256 | The ruling to query the reward from. |

#### Returns

| Name | Type | Description |
|---|---|---|
| reward | uint256 | The withdrawn amount. |

### withdrawFeesAndRewardsForAllRounds

```solidity
function withdrawFeesAndRewardsForAllRounds(uint256 _localDisputeId, address payable _beneficiary, uint256 _contributedTo) external nonpayable
```



*Allows to withdraw any rewards or reimbursable fees for all rounds at once.This function is O(n) where n is the total number of rounds. Arbitration cost of subsequent rounds is `A(n) = 2A(n-1) + 1`.  Thus because of this exponential growth of costs, you can assume n is less than 10 at all times.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _localDisputeId | uint256 | The ID of the related dispute. |
| _beneficiary | address payable | The address that made contributions. |
| _contributedTo | uint256 | Side that received contributions from contributor. |



## Events

### Challenged

```solidity
event Challenged(bytes32 indexed _claimId)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId `indexed` | bytes32 | undefined |

### Contribution

```solidity
event Contribution(uint256 indexed _localDisputeID, uint256 indexed _round, uint256 ruling, address indexed _contributor, uint256 _amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _localDisputeID `indexed` | uint256 | undefined |
| _round `indexed` | uint256 | undefined |
| ruling  | uint256 | undefined |
| _contributor `indexed` | address | undefined |
| _amount  | uint256 | undefined |

### Dispute

```solidity
event Dispute(contract IArbitrator indexed _arbitrator, uint256 indexed _disputeID, uint256 _metaEvidenceID, uint256 _evidenceGroupID)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _arbitrator `indexed` | contract IArbitrator | undefined |
| _disputeID `indexed` | uint256 | undefined |
| _metaEvidenceID  | uint256 | undefined |
| _evidenceGroupID  | uint256 | undefined |

### Evidence

```solidity
event Evidence(contract IArbitrator indexed _arbitrator, uint256 indexed _evidenceGroupID, address indexed _party, string _evidence)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _arbitrator `indexed` | contract IArbitrator | undefined |
| _evidenceGroupID `indexed` | uint256 | undefined |
| _party `indexed` | address | undefined |
| _evidence  | string | undefined |

### MetaEvidence

```solidity
event MetaEvidence(uint256 indexed _metaEvidenceID, string _evidence)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _metaEvidenceID `indexed` | uint256 | undefined |
| _evidence  | string | undefined |

### OwnershipTransferred

```solidity
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| previousOwner `indexed` | address | undefined |
| newOwner `indexed` | address | undefined |

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

### RulingFunded

```solidity
event RulingFunded(uint256 indexed _localDisputeID, uint256 indexed _round, uint256 indexed _ruling)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _localDisputeID `indexed` | uint256 | undefined |
| _round `indexed` | uint256 | undefined |
| _ruling `indexed` | uint256 | undefined |

### Withdrawal

```solidity
event Withdrawal(uint256 indexed _localDisputeID, uint256 indexed _round, uint256 _ruling, address indexed _contributor, uint256 _reward)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _localDisputeID `indexed` | uint256 | undefined |
| _round `indexed` | uint256 | undefined |
| _ruling  | uint256 | undefined |
| _contributor `indexed` | address | undefined |
| _reward  | uint256 | undefined |



