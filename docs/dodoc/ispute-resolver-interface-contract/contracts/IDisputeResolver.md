# IDisputeResolver



> This serves as a standard interface for crowdfunded appeals and evidence submission, which aren&#39;t a part of the arbitration (erc-792 and erc-1497) standard yet. This interface is used in Dispute Resolver (resolve.kleros.io).





## Methods

### VERSION

```solidity
function VERSION() external view returns (string)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | string | undefined |

### externalIDtoLocalID

```solidity
function externalIDtoLocalID(uint256 _externalDisputeID) external nonpayable returns (uint256 localDisputeID)
```



*Maps external (arbitrator side) dispute id to local (arbitrable) dispute id.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _externalDisputeID | uint256 | Dispute id as in arbitrator contract. |

#### Returns

| Name | Type | Description |
|---|---|---|
| localDisputeID | uint256 | Dispute id as in arbitrable contract. |

### fundAppeal

```solidity
function fundAppeal(uint256 _localDisputeID, uint256 _ruling) external payable returns (bool fullyFunded)
```



*Manages contributions and calls appeal function of the specified arbitrator to appeal a dispute. This function lets appeals be crowdfunded.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _localDisputeID | uint256 | Identifier of a dispute in scope of arbitrable contract. Arbitrator ids can be translated to local ids via externalIDtoLocalID. |
| _ruling | uint256 | The ruling option to which the caller wants to contribute. |

#### Returns

| Name | Type | Description |
|---|---|---|
| fullyFunded | bool | True if the ruling option got fully funded as a result of this contribution. |

### getMultipliers

```solidity
function getMultipliers() external view returns (uint256 winnerStakeMultiplier, uint256 loserStakeMultiplier, uint256 loserAppealPeriodMultiplier, uint256 denominator)
```



*Returns appeal multipliers.*


#### Returns

| Name | Type | Description |
|---|---|---|
| winnerStakeMultiplier | uint256 | Winners stake multiplier. |
| loserStakeMultiplier | uint256 | Losers stake multiplier. |
| loserAppealPeriodMultiplier | uint256 | Losers appeal period multiplier. The loser is given less time to fund its appeal to defend against last minute appeal funding attacks. |
| denominator | uint256 | Multiplier denominator in basis points. |

### getTotalWithdrawableAmount

```solidity
function getTotalWithdrawableAmount(uint256 _localDisputeID, address payable _contributor, uint256 _ruling) external view returns (uint256 sum)
```



*Returns the sum of withdrawable amount.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _localDisputeID | uint256 | Identifier of a dispute in scope of arbitrable contract. Arbitrator ids can be translated to local ids via externalIDtoLocalID. |
| _contributor | address payable | Beneficiary of withdraw operation. |
| _ruling | uint256 | Ruling option that caller wants to get withdrawable amount from. |

#### Returns

| Name | Type | Description |
|---|---|---|
| sum | uint256 | The total amount available to withdraw. |

### numberOfRulingOptions

```solidity
function numberOfRulingOptions(uint256 _localDisputeID) external view returns (uint256 count)
```



*Returns number of possible ruling options. Valid rulings are [0, return value].*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _localDisputeID | uint256 | Identifier of a dispute in scope of arbitrable contract. Arbitrator ids can be translated to local ids via externalIDtoLocalID. |

#### Returns

| Name | Type | Description |
|---|---|---|
| count | uint256 | The number of ruling options. |

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

### submitEvidence

```solidity
function submitEvidence(uint256 _localDisputeID, string _evidenceURI) external nonpayable
```



*Allows to submit evidence for a given dispute.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _localDisputeID | uint256 | Identifier of a dispute in scope of arbitrable contract. Arbitrator ids can be translated to local ids via externalIDtoLocalID. |
| _evidenceURI | string | IPFS path to evidence, example: &#39;/ipfs/Qmarwkf7C9RuzDEJNnarT3WZ7kem5bk8DZAzx78acJjMFH/evidence.json&#39; |

### withdrawFeesAndRewards

```solidity
function withdrawFeesAndRewards(uint256 _localDisputeID, address payable _contributor, uint256 _round, uint256 _ruling) external nonpayable returns (uint256 sum)
```



*Allows to withdraw any reimbursable fees or rewards after the dispute gets resolved.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _localDisputeID | uint256 | Identifier of a dispute in scope of arbitrable contract. Arbitrator ids can be translated to local ids via externalIDtoLocalID. |
| _contributor | address payable | Beneficiary of withdraw operation. |
| _round | uint256 | Number of the round that caller wants to execute withdraw on. |
| _ruling | uint256 | A ruling option that caller wants to execute withdraw on. |

#### Returns

| Name | Type | Description |
|---|---|---|
| sum | uint256 | The amount that is going to be transferred to contributor as a result of this function call. |

### withdrawFeesAndRewardsForAllRounds

```solidity
function withdrawFeesAndRewardsForAllRounds(uint256 _localDisputeID, address payable _contributor, uint256 _ruling) external nonpayable
```



*Allows to withdraw any rewards or reimbursable fees after the dispute gets resolved for all rounds at once.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _localDisputeID | uint256 | Identifier of a dispute in scope of arbitrable contract. Arbitrator ids can be translated to local ids via externalIDtoLocalID. |
| _contributor | address payable | Beneficiary of withdraw operation. |
| _ruling | uint256 | Ruling option that caller wants to execute withdraw on. |



## Events

### Contribution

```solidity
event Contribution(uint256 indexed _localDisputeID, uint256 indexed _round, uint256 ruling, address indexed _contributor, uint256 _amount)
```



*Raised when a contribution is made, inside fundAppeal function.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _localDisputeID `indexed` | uint256 | Identifier of a dispute in scope of arbitrable contract. Arbitrator ids can be translated to local ids via externalIDtoLocalID. |
| _round `indexed` | uint256 | The round number the contribution was made to. |
| ruling  | uint256 | Indicates the ruling option which got the contribution. |
| _contributor `indexed` | address | Caller of fundAppeal function. |
| _amount  | uint256 | Contribution amount. |

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



*To be raised when a ruling option is fully funded for appeal.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _localDisputeID `indexed` | uint256 | Identifier of a dispute in scope of arbitrable contract. Arbitrator ids can be translated to local ids via externalIDtoLocalID. |
| _round `indexed` | uint256 | Number of the round this ruling option was fully funded in. |
| _ruling `indexed` | uint256 | The ruling option which just got fully funded. |

### Withdrawal

```solidity
event Withdrawal(uint256 indexed _localDisputeID, uint256 indexed _round, uint256 _ruling, address indexed _contributor, uint256 _reward)
```



*Raised when a contributor withdraws non-zero value.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _localDisputeID `indexed` | uint256 | Identifier of a dispute in scope of arbitrable contract. Arbitrator ids can be translated to local ids via externalIDtoLocalID. |
| _round `indexed` | uint256 | The round number the withdrawal was made from. |
| _ruling  | uint256 | Indicates the ruling option which contributor gets rewards from. |
| _contributor `indexed` | address | The beneficiary of withdrawal. |
| _reward  | uint256 | Total amount of withdrawal, consists of reimbursed deposits plus rewards. |



