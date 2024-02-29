# IHATClaimsManager

*Hats.finance*

> Interface for Hats.finance Vaults

A HATVault holds the funds for a specific project&#39;s bug bounties. Anyone can permissionlessly deposit into the HATVault using the vault’s native token. When a bug is submitted and approved, the bounty  is paid out using the funds in the vault. Bounties are paid out as a percentage of the vault. The percentage is set according to the severity of the bug. Vaults have regular safety periods (typically for an hour twice a day) which are time for the committee to make decisions. In addition to the roles defined in the IHATVaultsRegistry, every HATVault  has the roles: Committee - The only address which can submit a claim for a bounty payout and set the maximum bounty. User - Anyone can deposit the vault&#39;s native token into the vault and  recieve shares for it. Shares represent the user&#39;s relative part in the vault, and when a bounty is paid out, users lose part of their deposits (based on percentage paid), but keep their share of the vault. Users also receive rewards for their deposits, which can be claimed at any  time. To withdraw previously deposited tokens, a user must first send a withdraw request, and the withdrawal will be made available after a pending period. Withdrawals are not permitted during safety periods or while there is an  active claim for a bounty payout. Bounties are payed out distributed between a few channels, and that  distribution is set upon creation (the hacker gets part in direct transfer, part in vested reward and part in vested HAT token, part gets rewarded to the committee, part gets swapped to HAT token and burned and/or sent to Hats governance). NOTE: Vaults should not use tokens which do not guarantee that the amount specified is the amount transferred This project is open-source and can be found at: https://github.com/hats-finance/hats-contracts



## Methods

### VERSION

```solidity
function VERSION() external view returns (string)
```

Returns the claims manager&#39;s version




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | string | The claims manager&#39;s version |

### approveClaim

```solidity
function approveClaim(bytes32 _claimId, uint16 _bountyPercentage, address _beneficiary) external nonpayable
```

Approve a claim for a bounty submitted by a committee, and pay out bounty to hacker and committee. Also transfer to the  IHATVaultsRegistry the part of the bounty that will be swapped to HAT  tokens. If the claim had been previously challenged, this is only callable by the arbitrator. Otherwise, callable by anyone after challengePeriod had passed.



#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId | bytes32 | The claim ID |
| _bountyPercentage | uint16 | The percentage of the vault&#39;s balance that will be sent as a bounty. This value will be ignored if the caller is not the arbitrator. |
| _beneficiary | address | where the bounty will be sent to. This value will be  ignored if the caller is not the arbitrator. |

### challengeClaim

```solidity
function challengeClaim(bytes32 _claimId) external nonpayable
```

Called by the arbitrator or governance to challenge a claim for a bounty payout that had been previously submitted by the committee. Can only be called during the challenge period after submission of the claim.



#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId | bytes32 | The claim ID |

### committeeCheckIn

```solidity
function committeeCheckIn() external nonpayable
```

Called by the vault&#39;s committee to claim it&#39;s role. Deposits are enabled only after committee check in.




### committeeCheckedIn

```solidity
function committeeCheckedIn() external view returns (bool)
```

Returns whether the committee has checked in




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | Whether the committee has checked in |

### dismissClaim

```solidity
function dismissClaim(bytes32 _claimId) external nonpayable
```

Dismiss the active claim for bounty payout submitted by the committee. Called either by the arbitrator, or by anyone if the claim has timed out.



#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId | bytes32 | The claim ID |

### getActiveClaim

```solidity
function getActiveClaim() external view returns (struct IHATClaimsManager.Claim)
```

Returns the current active claim




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | IHATClaimsManager.Claim | The current active claim |

### getArbitrator

```solidity
function getArbitrator() external view returns (address)
```

Returns the address of the vault&#39;s arbitrator If no specific value for this vault has been set, the registry&#39;s default value will be returned.




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | The address of the vault&#39;s arbitrator |

### getChallengePeriod

```solidity
function getChallengePeriod() external view returns (uint32)
```

Returns the period of time after a claim for a bounty payout has been submitted that it can be challenged by the arbitrator. If no specific value for this vault has been set, the registry&#39;s default value will be returned.




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint32 | The vault&#39;s challenge period |

### getChallengeTimeOutPeriod

```solidity
function getChallengeTimeOutPeriod() external view returns (uint32)
```

Returns the period of time after which a claim for a bounty payout can be dismissed by anyone. If no specific value for this vault has been set, the registry&#39;s default value will be returned.




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint32 | The vault&#39;s challenge timeout period |

### getGovernanceFee

```solidity
function getGovernanceFee() external view returns (uint16)
```

Returns the vault fee split that goes to the governance If no specific value for this vault has been set, the registry&#39;s default value will be returned.




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint16 | The vault&#39;s fee split that goes to the governance |

### initialize

```solidity
function initialize(contract IHATVault _vault, IHATClaimsManager.ClaimsManagerInitParams _params) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vault | contract IHATVault | undefined |
| _params | IHATClaimsManager.ClaimsManagerInitParams | undefined |

### maxBounty

```solidity
function maxBounty() external view returns (uint16)
```

Returns the max bounty that can be paid from the vault in percentages out of HUNDRED_PERCENT




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint16 | The max bounty |

### registry

```solidity
function registry() external view returns (contract IHATVaultsRegistry)
```

Returns the vault&#39;s registry




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IHATVaultsRegistry | The registry&#39;s address |

### setArbitrator

```solidity
function setArbitrator(address _arbitrator) external nonpayable
```

Called by the registry&#39;s owner to set the vault arbitrator If the value passed is the special &quot;null&quot; value the vault will use the registry&#39;s default value.



#### Parameters

| Name | Type | Description |
|---|---|---|
| _arbitrator | address | The address of vault&#39;s arbitrator |

### setArbitratorOptions

```solidity
function setArbitratorOptions(bool _arbitratorCanChangeBounty, bool _arbitratorCanChangeBeneficiary, bool _arbitratorCanSubmitClaims) external nonpayable
```

Called by the registry&#39;s owner to set whether the arbitrator can change a claim bounty percentage and/ or beneficiary If the value passed is the special &quot;null&quot; value the vault will use the registry&#39;s default value.



#### Parameters

| Name | Type | Description |
|---|---|---|
| _arbitratorCanChangeBounty | bool | Whether the arbitrator can change a claim bounty percentage |
| _arbitratorCanChangeBeneficiary | bool | Whether the arbitrator can change a claim beneficiary |
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

Called by the registry&#39;s owner to set the period of time after a claim for a bounty payout has been submitted that it can be challenged by the arbitrator. If the value passed is the special &quot;null&quot; value the vault will use the registry&#39;s default value.



#### Parameters

| Name | Type | Description |
|---|---|---|
| _challengePeriod | uint32 | The vault&#39;s challenge period |

### setChallengeTimeOutPeriod

```solidity
function setChallengeTimeOutPeriod(uint32 _challengeTimeOutPeriod) external nonpayable
```

Called by the registry&#39;s owner to set the period of time after which a claim for a bounty payout can be dismissed by anyone. If the value passed is the special &quot;null&quot; value the vault will use the registry&#39;s default value.



#### Parameters

| Name | Type | Description |
|---|---|---|
| _challengeTimeOutPeriod | uint32 | The vault&#39;s challenge timeout period |

### setCommittee

```solidity
function setCommittee(address _committee) external nonpayable
```

Set new committee address. Can be called by existing committee, or by the the vault&#39;s owner in the case that the committee hadn&#39;t checked in yet.



#### Parameters

| Name | Type | Description |
|---|---|---|
| _committee | address | The address of the new committee  |

### setGovernanceFee

```solidity
function setGovernanceFee(uint16 _governanceFee) external nonpayable
```

Called by the registry&#39;s owner to set the fee percentage for payouts  If the value passed is the special &quot;null&quot; value the vault will use the registry&#39;s default value.



#### Parameters

| Name | Type | Description |
|---|---|---|
| _governanceFee | uint16 | The fee percentage for governance |

### setMaxBounty

```solidity
function setMaxBounty() external nonpayable
```

Called by the vault&#39;s owner to set the vault&#39;s max bounty to the already pending max bounty. Cannot be called if there are active claims that have been submitted. Can only be called if there is a max bounty pending approval, and the time delay since setting the pending max bounty had passed.




### setPendingMaxBounty

```solidity
function setPendingMaxBounty(uint16 _maxBounty) external nonpayable
```

Called by the vault&#39;s owner to set a pending request for the maximum percentage of the vault that can be paid out as a bounty. Cannot be called if there is an active claim that has been submitted. Max bounty should be less than or equal to 90% (defined as 9000). It can also be set to 100%, but in this mode the vault will only allow payouts of the 100%, and the vault will become inactive forever afterwards. The pending value can be set by the owner after the time delay (of  {IHATVaultsRegistry.generalParameters.setMaxBountyDelay}) had passed.



#### Parameters

| Name | Type | Description |
|---|---|---|
| _maxBounty | uint16 | The maximum bounty percentage that can be paid out |

### setVestingParams

```solidity
function setVestingParams(uint32 _duration, uint32 _periods) external nonpayable
```

Called by the vault&#39;s owner to set the vesting params for the part of the bounty that the hacker gets vested in the vault&#39;s native token



#### Parameters

| Name | Type | Description |
|---|---|---|
| _duration | uint32 | Duration of the vesting period. Must be smaller than 120 days and bigger than `_periods` |
| _periods | uint32 | Number of vesting periods. Cannot be 0. |

### submitClaim

```solidity
function submitClaim(address _beneficiary, uint16 _bountyPercentage, string _descriptionHash) external nonpayable returns (bytes32 claimId)
```

Called by the committee to submit a claim for a bounty payout. This function should be called only on a safety period, when withdrawals are disabled, and while there&#39;s no other active claim. Cannot be called when the registry is in an emergency pause. Upon a call to this function by the committee the vault&#39;s withdrawals will be disabled until the claim is approved or dismissed. Also from the time of this call the arbitrator will have a period of  {IHATVaultsRegistry.challengePeriod} to challenge the claim.



#### Parameters

| Name | Type | Description |
|---|---|---|
| _beneficiary | address | The submitted claim&#39;s beneficiary |
| _bountyPercentage | uint16 | The submitted claim&#39;s bug requested reward percentage |
| _descriptionHash | string | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| claimId | bytes32 | undefined |



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







