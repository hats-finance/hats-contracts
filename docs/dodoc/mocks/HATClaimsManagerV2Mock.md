# HATClaimsManagerV2Mock









## Methods

### HUNDRED_PERCENT

```solidity
function HUNDRED_PERCENT() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### HUNDRED_PERCENT_SQRD

```solidity
function HUNDRED_PERCENT_SQRD() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### MAX_BOUNTY_LIMIT

```solidity
function MAX_BOUNTY_LIMIT() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### MAX_COMMITTEE_BOUNTY

```solidity
function MAX_COMMITTEE_BOUNTY() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### NULL_ADDRESS

```solidity
function NULL_ADDRESS() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### NULL_UINT16

```solidity
function NULL_UINT16() external view returns (uint16)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint16 | undefined |

### NULL_UINT32

```solidity
function NULL_UINT32() external view returns (uint32)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint32 | undefined |

### VERSION

```solidity
function VERSION() external view returns (string)
```

Returns the claims manager&#39;s version




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | string | undefined |

### activeClaim

```solidity
function activeClaim() external view returns (bytes32 claimId, address beneficiary, uint16 bountyPercentage, address committee, uint32 createdAt, uint32 challengedAt, uint16 governanceFee, address arbitrator, uint32 challengePeriod, uint32 challengeTimeOutPeriod, bool arbitratorCanChangeBounty, bool arbitratorCanChangeBeneficiary)
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
| governanceFee | uint16 | undefined |
| arbitrator | address | undefined |
| challengePeriod | uint32 | undefined |
| challengeTimeOutPeriod | uint32 | undefined |
| arbitratorCanChangeBounty | bool | undefined |
| arbitratorCanChangeBeneficiary | bool | undefined |

### approveClaim

```solidity
function approveClaim(bytes32 _claimId, uint16 _bountyPercentage, address _beneficiary) external nonpayable
```

See {IHATClaimsManager-approveClaim}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId | bytes32 | undefined |
| _bountyPercentage | uint16 | undefined |
| _beneficiary | address | undefined |

### arbitratorCanChangeBeneficiary

```solidity
function arbitratorCanChangeBeneficiary() external view returns (bool)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### arbitratorCanChangeBounty

```solidity
function arbitratorCanChangeBounty() external view returns (bool)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### arbitratorCanSubmitClaims

```solidity
function arbitratorCanSubmitClaims() external view returns (bool)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### bountySplit

```solidity
function bountySplit() external view returns (uint16 hackerVested, uint16 hacker, uint16 committee)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| hackerVested | uint16 | undefined |
| hacker | uint16 | undefined |
| committee | uint16 | undefined |

### challengeClaim

```solidity
function challengeClaim(bytes32 _claimId) external nonpayable
```

Called by the arbitrator or governance to challenge a claim for a bounty payout that had been previously submitted by the committee. Can only be called during the challenge period after submission of the claim.



#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId | bytes32 | The claim ID |

### committee

```solidity
function committee() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### committeeCheckIn

```solidity
function committeeCheckIn() external nonpayable
```

See {IHATClaimsManager-committeeCheckIn}. 




### committeeCheckedIn

```solidity
function committeeCheckedIn() external view returns (bool)
```

Returns whether the committee has checked in




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### dismissClaim

```solidity
function dismissClaim(bytes32 _claimId) external nonpayable
```

See {IHATClaimsManager-dismissClaim}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId | bytes32 | undefined |

### getActiveClaim

```solidity
function getActiveClaim() external view returns (struct IHATClaimsManager.Claim)
```

See {IHATClaimsManager-getActiveClaim}. 




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | IHATClaimsManager.Claim | undefined |

### getArbitrator

```solidity
function getArbitrator() external view returns (address)
```

See {IHATClaimsManager-getArbitrator}. 




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### getChallengePeriod

```solidity
function getChallengePeriod() external view returns (uint32)
```

See {IHATClaimsManager-getChallengePeriod}. 




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint32 | undefined |

### getChallengeTimeOutPeriod

```solidity
function getChallengeTimeOutPeriod() external view returns (uint32)
```

See {IHATClaimsManager-getChallengeTimeOutPeriod}. 




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint32 | undefined |

### getGovernanceFee

```solidity
function getGovernanceFee() external view returns (uint16)
```

See {IHATClaimsManager-getGovernanceFee}. 




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint16 | undefined |

### getVersion

```solidity
function getVersion() external pure returns (string)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | string | undefined |

### initialize

```solidity
function initialize(contract IHATVault _vault, IHATClaimsManager.ClaimsManagerInitParams _params) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract IHATVault | undefined |
| _params | IHATClaimsManager.ClaimsManagerInitParams | undefined |

### isTokenLockRevocable

```solidity
function isTokenLockRevocable() external view returns (bool)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### maxBounty

```solidity
function maxBounty() external view returns (uint16)
```

Returns the max bounty that can be paid from the vault in percentages out of HUNDRED_PERCENT




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint16 | undefined |

### owner

```solidity
function owner() external view returns (address)
```



*Returns the address of the current owner.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### pendingMaxBounty

```solidity
function pendingMaxBounty() external view returns (uint16 maxBounty, uint32 timestamp)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| maxBounty | uint16 | undefined |
| timestamp | uint32 | undefined |

### registry

```solidity
function registry() external view returns (contract IHATVaultsRegistry)
```

Returns the vault&#39;s registry




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IHATVaultsRegistry | undefined |

### renounceOwnership

```solidity
function renounceOwnership() external nonpayable
```



*Leaves the contract without owner. It will not be possible to call `onlyOwner` functions anymore. Can only be called by the current owner. NOTE: Renouncing ownership will leave the contract without an owner, thereby removing any functionality that is only available to the owner.*


### setArbitrator

```solidity
function setArbitrator(address _arbitrator) external nonpayable
```

See {IHATClaimsManager-setArbitrator}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _arbitrator | address | undefined |

### setArbitratorOptions

```solidity
function setArbitratorOptions(bool _arbitratorCanChangeBounty, bool _arbitratorCanChangeBeneficiary, bool _arbitratorCanSubmitClaims) external nonpayable
```

See {IHATClaimsManager-setArbitratorOptions}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _arbitratorCanChangeBounty | bool | undefined |
| _arbitratorCanChangeBeneficiary | bool | undefined |
| _arbitratorCanSubmitClaims | bool | undefined |

### setBountySplit

```solidity
function setBountySplit(IHATClaimsManager.BountySplit _bountySplit) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _bountySplit | IHATClaimsManager.BountySplit | undefined |

### setChallengePeriod

```solidity
function setChallengePeriod(uint32 _challengePeriod) external nonpayable
```

See {IHATClaimsManager-setChallengePeriod}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _challengePeriod | uint32 | undefined |

### setChallengeTimeOutPeriod

```solidity
function setChallengeTimeOutPeriod(uint32 _challengeTimeOutPeriod) external nonpayable
```

See {IHATClaimsManager-setChallengeTimeOutPeriod}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _challengeTimeOutPeriod | uint32 | undefined |

### setCommittee

```solidity
function setCommittee(address _committee) external nonpayable
```

See {IHATClaimsManager-setCommittee}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _committee | address | undefined |

### setGovernanceFee

```solidity
function setGovernanceFee(uint16 _governanceFee) external nonpayable
```

See {IHATClaimsManager-setGoveranceFee}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _governanceFee | uint16 | undefined |

### setMaxBounty

```solidity
function setMaxBounty() external nonpayable
```

See {IHATClaimsManager-setMaxBounty}. 




### setPendingMaxBounty

```solidity
function setPendingMaxBounty(uint16 _maxBounty) external nonpayable
```

See {IHATClaimsManager-setPendingMaxBounty}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _maxBounty | uint16 | undefined |

### setVestingParams

```solidity
function setVestingParams(uint32 _duration, uint32 _periods) external nonpayable
```

See {IHATClaimsManager-setVestingParams}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _duration | uint32 | undefined |
| _periods | uint32 | undefined |

### submitClaim

```solidity
function submitClaim(address _beneficiary, uint16 _bountyPercentage, string _descriptionHash) external nonpayable returns (bytes32 claimId)
```

See {IHATClaimsManager-submitClaim}. 



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

### tokenLockFactory

```solidity
function tokenLockFactory() external view returns (contract ITokenLockFactory)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract ITokenLockFactory | undefined |

### transferOwnership

```solidity
function transferOwnership(address newOwner) external nonpayable
```



*Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| newOwner | address | undefined |

### vault

```solidity
function vault() external view returns (contract IHATVault)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IHATVault | undefined |

### vestingDuration

```solidity
function vestingDuration() external view returns (uint32)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint32 | undefined |

### vestingPeriods

```solidity
function vestingPeriods() external view returns (uint32)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint32 | undefined |



## Events

### ApproveClaim

```solidity
event ApproveClaim(bytes32 indexed _claimId, address _committee, address indexed _approver, address indexed _beneficiary, uint256 _bountyPercentage, address _tokenLock, IHATClaimsManager.ClaimBounty _claimBounty)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId `indexed` | bytes32 | undefined |
| _committee  | address | undefined |
| _approver `indexed` | address | undefined |
| _beneficiary `indexed` | address | undefined |
| _bountyPercentage  | uint256 | undefined |
| _tokenLock  | address | undefined |
| _claimBounty  | IHATClaimsManager.ClaimBounty | undefined |

### ChallengeClaim

```solidity
event ChallengeClaim(bytes32 indexed _claimId)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId `indexed` | bytes32 | undefined |

### CommitteeCheckedIn

```solidity
event CommitteeCheckedIn()
```






### DismissClaim

```solidity
event DismissClaim(bytes32 indexed _claimId)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId `indexed` | bytes32 | undefined |

### Initialized

```solidity
event Initialized(uint8 version)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| version  | uint8 | undefined |

### OwnershipTransferred

```solidity
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| previousOwner `indexed` | address | undefined |
| newOwner `indexed` | address | undefined |

### SetArbitrator

```solidity
event SetArbitrator(address indexed _arbitrator)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _arbitrator `indexed` | address | undefined |

### SetArbitratorOptions

```solidity
event SetArbitratorOptions(bool _arbitratorCanChangeBounty, bool _arbitratorCanChangeBeneficiary, bool _arbitratorCanSubmitClaims)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _arbitratorCanChangeBounty  | bool | undefined |
| _arbitratorCanChangeBeneficiary  | bool | undefined |
| _arbitratorCanSubmitClaims  | bool | undefined |

### SetBountySplit

```solidity
event SetBountySplit(IHATClaimsManager.BountySplit _bountySplit)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _bountySplit  | IHATClaimsManager.BountySplit | undefined |

### SetChallengePeriod

```solidity
event SetChallengePeriod(uint256 _challengePeriod)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _challengePeriod  | uint256 | undefined |

### SetChallengeTimeOutPeriod

```solidity
event SetChallengeTimeOutPeriod(uint256 _challengeTimeOutPeriod)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _challengeTimeOutPeriod  | uint256 | undefined |

### SetCommittee

```solidity
event SetCommittee(address indexed _committee)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _committee `indexed` | address | undefined |

### SetGovernanceFee

```solidity
event SetGovernanceFee(uint16 _governanceFee)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _governanceFee  | uint16 | undefined |

### SetMaxBounty

```solidity
event SetMaxBounty(uint256 _maxBounty)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _maxBounty  | uint256 | undefined |

### SetPendingMaxBounty

```solidity
event SetPendingMaxBounty(uint256 _maxBounty)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _maxBounty  | uint256 | undefined |

### SetVestingParams

```solidity
event SetVestingParams(uint256 _duration, uint256 _periods)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _duration  | uint256 | undefined |
| _periods  | uint256 | undefined |

### SubmitClaim

```solidity
event SubmitClaim(bytes32 indexed _claimId, address _committee, address indexed _submitter, address indexed _beneficiary, uint256 _bountyPercentage, string _descriptionHash)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId `indexed` | bytes32 | undefined |
| _committee  | address | undefined |
| _submitter `indexed` | address | undefined |
| _beneficiary `indexed` | address | undefined |
| _bountyPercentage  | uint256 | undefined |
| _descriptionHash  | string | undefined |



## Errors

### ActiveClaimExists

```solidity
error ActiveClaimExists()
```






### BountyPercentageHigherThanMaxBounty

```solidity
error BountyPercentageHigherThanMaxBounty()
```






### CannotSetToPerviousRewardController

```solidity
error CannotSetToPerviousRewardController()
```






### ChallengePeriodEnded

```solidity
error ChallengePeriodEnded()
```






### ChallengedClaimCanOnlyBeApprovedByArbitratorUntilChallengeTimeoutPeriod

```solidity
error ChallengedClaimCanOnlyBeApprovedByArbitratorUntilChallengeTimeoutPeriod()
```






### ClaimAlreadyChallenged

```solidity
error ClaimAlreadyChallenged()
```






### ClaimExpired

```solidity
error ClaimExpired()
```






### ClaimIdIsNotActive

```solidity
error ClaimIdIsNotActive()
```






### CommitteeAlreadyCheckedIn

```solidity
error CommitteeAlreadyCheckedIn()
```






### CommitteeBountyCannotBeMoreThanMax

```solidity
error CommitteeBountyCannotBeMoreThanMax()
```






### DelayPeriodForSettingMaxBountyHadNotPassed

```solidity
error DelayPeriodForSettingMaxBountyHadNotPassed()
```






### FeeCannotBeMoreThanMaxFee

```solidity
error FeeCannotBeMoreThanMaxFee()
```






### MaxBountyCannotBeMoreThanMaxBountyLimit

```solidity
error MaxBountyCannotBeMoreThanMaxBountyLimit()
```






### NoActiveClaimExists

```solidity
error NoActiveClaimExists()
```






### NoPendingMaxBounty

```solidity
error NoPendingMaxBounty()
```






### NotEnoughFeePaid

```solidity
error NotEnoughFeePaid()
```






### NotEnoughUserBalance

```solidity
error NotEnoughUserBalance()
```






### NotSafetyPeriod

```solidity
error NotSafetyPeriod()
```






### OnlyArbitratorOrRegistryOwner

```solidity
error OnlyArbitratorOrRegistryOwner()
```






### OnlyCallableByArbitratorOrAfterChallengeTimeOutPeriod

```solidity
error OnlyCallableByArbitratorOrAfterChallengeTimeOutPeriod()
```






### OnlyCallableIfChallenged

```solidity
error OnlyCallableIfChallenged()
```






### OnlyCommittee

```solidity
error OnlyCommittee()
```






### OnlyRegistryOwner

```solidity
error OnlyRegistryOwner()
```






### PayoutMustBeUpToMaxBountyLimitOrHundredPercent

```solidity
error PayoutMustBeUpToMaxBountyLimitOrHundredPercent()
```






### SafetyPeriod

```solidity
error SafetyPeriod()
```






### SetSharesArraysMustHaveSameLength

```solidity
error SetSharesArraysMustHaveSameLength()
```






### SystemInEmergencyPause

```solidity
error SystemInEmergencyPause()
```






### TotalSplitPercentageShouldBeHundredPercent

```solidity
error TotalSplitPercentageShouldBeHundredPercent()
```






### UnchallengedClaimCanOnlyBeApprovedAfterChallengePeriod

```solidity
error UnchallengedClaimCanOnlyBeApprovedAfterChallengePeriod()
```






### VestingDurationSmallerThanPeriods

```solidity
error VestingDurationSmallerThanPeriods()
```






### VestingDurationTooLong

```solidity
error VestingDurationTooLong()
```






### VestingPeriodsCannotBeZero

```solidity
error VestingPeriodsCannotBeZero()
```







