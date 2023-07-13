# HATVault

*Hats.finance*

> A Hats.finance vault which holds the funds for a specific project&#39;s bug bounties

The HATVault can be deposited into in a permissionless manner using the vault’s native token. When a bug is submitted and approved, the bounty  is paid out using the funds in the vault. Bounties are paid out as a percentage of the vault. The percentage is set according to the severity of the bug. Vaults have regular safety periods (typically for an hour twice a day) which are time for the committee to make decisions. In addition to the roles defined in the HATVaultsRegistry, every HATVault  has the roles: Committee - The only address which can submit a claim for a bounty payout and set the maximum bounty. User - Anyone can deposit the vault&#39;s native token into the vault and  recieve shares for it. Shares represent the user&#39;s relative part in the vault, and when a bounty is paid out, users lose part of their deposits (based on percentage paid), but keep their share of the vault. Users also receive rewards for their deposits, which can be claimed at any time. To withdraw previously deposited tokens, a user must first send a withdraw request, and the withdrawal will be made available after a pending period. Withdrawals are not permitted during safety periods or while there is an  active claim for a bounty payout. Bounties are payed out distributed between a few channels, and that  distribution is set upon creation (the hacker gets part in direct transfer, part in vested reward and part in vested HAT token, part gets rewarded to the committee, part gets swapped to HAT token and burned and/or sent to Hats governance). This project is open-source and can be found at: https://github.com/hats-finance/hats-contracts



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

### MAX_UINT

```solidity
function MAX_UINT() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### MAX_WITHDRAWAL_FEE

```solidity
function MAX_WITHDRAWAL_FEE() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### MINIMAL_AMOUNT_OF_SHARES

```solidity
function MINIMAL_AMOUNT_OF_SHARES() external view returns (uint256)
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

Returns the vault&#39;s version




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | string | The vault&#39;s version |

### activeClaim

```solidity
function activeClaim() external view returns (bytes32 claimId, address beneficiary, uint16 bountyPercentage, address committee, uint32 createdAt, uint32 challengedAt, uint256 bountyGovernanceHAT, uint256 bountyHackerHATVested, address arbitrator, uint32 challengePeriod, uint32 challengeTimeOutPeriod, bool arbitratorCanChangeBounty, bool arbitratorCanChangeBeneficiary)
```

Returns the current active claim




#### Returns

| Name | Type | Description |
|---|---|---|
| claimId | bytes32 | The current active claim |
| beneficiary | address | undefined |
| bountyPercentage | uint16 | undefined |
| committee | address | undefined |
| createdAt | uint32 | undefined |
| challengedAt | uint32 | undefined |
| bountyGovernanceHAT | uint256 | undefined |
| bountyHackerHATVested | uint256 | undefined |
| arbitrator | address | undefined |
| challengePeriod | uint32 | undefined |
| challengeTimeOutPeriod | uint32 | undefined |
| arbitratorCanChangeBounty | bool | undefined |
| arbitratorCanChangeBeneficiary | bool | undefined |

### addRewardController

```solidity
function addRewardController(contract IRewardController _rewardController) external nonpayable
```

See {IHATVault-addRewardController}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _rewardController | contract IRewardController | undefined |

### allowance

```solidity
function allowance(address owner, address spender) external view returns (uint256)
```



*See {IERC20-allowance}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| owner | address | undefined |
| spender | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### approve

```solidity
function approve(address spender, uint256 amount) external nonpayable returns (bool)
```



*See {IERC20-approve}. NOTE: If `amount` is the maximum `uint256`, the allowance is not updated on `transferFrom`. This is semantically equivalent to an infinite approval. Requirements: - `spender` cannot be the zero address.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| spender | address | undefined |
| amount | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### approveClaim

```solidity
function approveClaim(bytes32 _claimId, uint16 _bountyPercentage, address _beneficiary) external nonpayable
```

See {IHATVault-approveClaim}. 



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

### asset

```solidity
function asset() external view returns (address)
```



*See {IERC4626-asset}. *


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### balanceOf

```solidity
function balanceOf(address account) external view returns (uint256)
```



*See {IERC20-balanceOf}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

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

See {IHATVault-committeeCheckIn}. 




### committeeCheckedIn

```solidity
function committeeCheckedIn() external view returns (bool)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### convertToAssets

```solidity
function convertToAssets(uint256 shares) external view returns (uint256 assets)
```



*See {IERC4626-convertToAssets}. *

#### Parameters

| Name | Type | Description |
|---|---|---|
| shares | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| assets | uint256 | undefined |

### convertToShares

```solidity
function convertToShares(uint256 assets) external view returns (uint256 shares)
```



*See {IERC4626-convertToShares}. *

#### Parameters

| Name | Type | Description |
|---|---|---|
| assets | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| shares | uint256 | undefined |

### decimals

```solidity
function decimals() external view returns (uint8)
```



*Decimals are read from the underlying asset in the constructor and cached. If this fails (e.g., the asset has not been created yet), the cached value is set to a default obtained by `super.decimals()` (which depends on inheritance but is most likely 18). Override this function in order to set a guaranteed hardcoded value. See {IERC20Metadata-decimals}.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint8 | undefined |

### decreaseAllowance

```solidity
function decreaseAllowance(address spender, uint256 subtractedValue) external nonpayable returns (bool)
```



*Atomically decreases the allowance granted to `spender` by the caller. This is an alternative to {approve} that can be used as a mitigation for problems described in {IERC20-approve}. Emits an {Approval} event indicating the updated allowance. Requirements: - `spender` cannot be the zero address. - `spender` must have allowance for the caller of at least `subtractedValue`.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| spender | address | undefined |
| subtractedValue | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### deposit

```solidity
function deposit(uint256 assets, address receiver) external nonpayable returns (uint256)
```

See {IHATVault-deposit}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| assets | uint256 | undefined |
| receiver | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### deposit

```solidity
function deposit(uint256 assets, address receiver, uint256 minShares) external nonpayable returns (uint256)
```

See {IHATVault-deposit}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| assets | uint256 | undefined |
| receiver | address | undefined |
| minShares | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### depositPause

```solidity
function depositPause() external view returns (bool)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### dismissClaim

```solidity
function dismissClaim(bytes32 _claimId) external nonpayable
```

See {IHATVault-dismissClaim}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId | bytes32 | undefined |

### emergencyWithdraw

```solidity
function emergencyWithdraw(address receiver) external nonpayable returns (uint256 assets)
```

See {IHATVault-emergencyWithdraw}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| receiver | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| assets | uint256 | undefined |

### getArbitrator

```solidity
function getArbitrator() external view returns (address)
```

See {IHATVault-getArbitrator}. 




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### getBountyGovernanceHAT

```solidity
function getBountyGovernanceHAT() external view returns (uint16)
```

See {IHATVault-getBountyGovernanceHAT}. 




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint16 | undefined |

### getBountyHackerHATVested

```solidity
function getBountyHackerHATVested() external view returns (uint16)
```

See {IHATVault-getBountyHackerHATVested}. 




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint16 | undefined |

### getChallengePeriod

```solidity
function getChallengePeriod() external view returns (uint32)
```

See {IHATVault-getChallengePeriod}. 




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint32 | undefined |

### getChallengeTimeOutPeriod

```solidity
function getChallengeTimeOutPeriod() external view returns (uint32)
```

See {IHATVault-getChallengeTimeOutPeriod}. 




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint32 | undefined |

### increaseAllowance

```solidity
function increaseAllowance(address spender, uint256 addedValue) external nonpayable returns (bool)
```



*Atomically increases the allowance granted to `spender` by the caller. This is an alternative to {approve} that can be used as a mitigation for problems described in {IERC20-approve}. Emits an {Approval} event indicating the updated allowance. Requirements: - `spender` cannot be the zero address.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| spender | address | undefined |
| addedValue | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### initialize

```solidity
function initialize(IHATVault.VaultInitParams _params) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _params | IHATVault.VaultInitParams | undefined |

### maxBounty

```solidity
function maxBounty() external view returns (uint16)
```

Returns the max bounty that can be paid from the vault in percentages out of HUNDRED_PERCENT




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint16 | The max bounty |

### maxDeposit

```solidity
function maxDeposit(address) external view returns (uint256)
```

See {IERC4626Upgradeable-maxDeposit}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### maxMint

```solidity
function maxMint(address) external view returns (uint256)
```

See {IERC4626Upgradeable-maxMint}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### maxRedeem

```solidity
function maxRedeem(address owner) external view returns (uint256)
```

See {IERC4626Upgradeable-maxRedeem}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| owner | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### maxWithdraw

```solidity
function maxWithdraw(address owner) external view returns (uint256)
```

See {IERC4626Upgradeable-maxWithdraw}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| owner | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### mint

```solidity
function mint(uint256 shares, address receiver, uint256 maxAssets) external nonpayable returns (uint256)
```

See {IHATVault-mint}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| shares | uint256 | undefined |
| receiver | address | undefined |
| maxAssets | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### mint

```solidity
function mint(uint256 shares, address receiver) external nonpayable returns (uint256)
```



*See {IERC4626-mint}. As opposed to {deposit}, minting is allowed even if the vault is in a state where the price of a share is zero. In this case, the shares will be minted without requiring any assets to be deposited.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| shares | uint256 | undefined |
| receiver | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### name

```solidity
function name() external view returns (string)
```



*Returns the name of the token.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | string | undefined |

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

### previewDeposit

```solidity
function previewDeposit(uint256 assets) external view returns (uint256)
```



*See {IERC4626-previewDeposit}. *

#### Parameters

| Name | Type | Description |
|---|---|---|
| assets | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### previewMint

```solidity
function previewMint(uint256 shares) external view returns (uint256)
```



*See {IERC4626-previewMint}. *

#### Parameters

| Name | Type | Description |
|---|---|---|
| shares | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### previewRedeem

```solidity
function previewRedeem(uint256 shares) external view returns (uint256 assets)
```

See {IERC4626Upgradeable-previewRedeem}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| shares | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| assets | uint256 | undefined |

### previewRedeemAndFee

```solidity
function previewRedeemAndFee(uint256 shares) external view returns (uint256 assets, uint256 fee)
```

See {IHATVault-previewRedeemAndFee}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| shares | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| assets | uint256 | undefined |
| fee | uint256 | undefined |

### previewWithdraw

```solidity
function previewWithdraw(uint256 assets) external view returns (uint256 shares)
```

See {IERC4626Upgradeable-previewWithdraw}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| assets | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| shares | uint256 | undefined |

### previewWithdrawAndFee

```solidity
function previewWithdrawAndFee(uint256 assets) external view returns (uint256 shares, uint256 fee)
```

See {IHATVault-previewWithdrawAndFee}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| assets | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| shares | uint256 | undefined |
| fee | uint256 | undefined |

### redeem

```solidity
function redeem(uint256 shares, address receiver, address owner, uint256 minAssets) external nonpayable returns (uint256)
```

See {IHATVault-redeem}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| shares | uint256 | undefined |
| receiver | address | undefined |
| owner | address | undefined |
| minAssets | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### redeem

```solidity
function redeem(uint256 shares, address receiver, address owner) external nonpayable returns (uint256)
```

See {IHATVault-redeem}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| shares | uint256 | undefined |
| receiver | address | undefined |
| owner | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### redeemAndClaim

```solidity
function redeemAndClaim(uint256 shares, address receiver, address owner, uint256 minAssets) external nonpayable returns (uint256 assets)
```

See {IHATVault-redeemAndClaim}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| shares | uint256 | undefined |
| receiver | address | undefined |
| owner | address | undefined |
| minAssets | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| assets | uint256 | undefined |

### redeemAndClaim

```solidity
function redeemAndClaim(uint256 shares, address receiver, address owner) external nonpayable returns (uint256 assets)
```

See {IHATVault-redeemAndClaim}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| shares | uint256 | undefined |
| receiver | address | undefined |
| owner | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| assets | uint256 | undefined |

### registry

```solidity
function registry() external view returns (contract HATVaultsRegistry)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract HATVaultsRegistry | undefined |

### renounceOwnership

```solidity
function renounceOwnership() external nonpayable
```



*Leaves the contract without owner. It will not be possible to call `onlyOwner` functions anymore. Can only be called by the current owner. NOTE: Renouncing ownership will leave the contract without an owner, thereby removing any functionality that is only available to the owner.*


### rewardControllers

```solidity
function rewardControllers(uint256) external view returns (contract IRewardController)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IRewardController | undefined |

### setArbitrator

```solidity
function setArbitrator(address _arbitrator) external nonpayable
```

See {IHATVault-setArbitrator}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _arbitrator | address | undefined |

### setArbitratorOptions

```solidity
function setArbitratorOptions(bool _arbitratorCanChangeBounty, bool _arbitratorCanChangeBeneficiary, bool _arbitratorCanSubmitClaims) external nonpayable
```

See {IHATVault-setArbitratorOptions}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _arbitratorCanChangeBounty | bool | undefined |
| _arbitratorCanChangeBeneficiary | bool | undefined |
| _arbitratorCanSubmitClaims | bool | undefined |

### setBountySplit

```solidity
function setBountySplit(IHATVault.BountySplit _bountySplit) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _bountySplit | IHATVault.BountySplit | undefined |

### setChallengePeriod

```solidity
function setChallengePeriod(uint32 _challengePeriod) external nonpayable
```

See {IHATVault-setChallengePeriod}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _challengePeriod | uint32 | undefined |

### setChallengeTimeOutPeriod

```solidity
function setChallengeTimeOutPeriod(uint32 _challengeTimeOutPeriod) external nonpayable
```

See {IHATVault-setChallengeTimeOutPeriod}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _challengeTimeOutPeriod | uint32 | undefined |

### setCommittee

```solidity
function setCommittee(address _committee) external nonpayable
```

See {IHATVault-setCommittee}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _committee | address | undefined |

### setDepositPause

```solidity
function setDepositPause(bool _depositPause) external nonpayable
```

See {IHATVault-setDepositPause}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _depositPause | bool | undefined |

### setHATBountySplit

```solidity
function setHATBountySplit(uint16 _bountyGovernanceHAT, uint16 _bountyHackerHATVested) external nonpayable
```

See {IHATVault-setHATBountySplit}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _bountyGovernanceHAT | uint16 | undefined |
| _bountyHackerHATVested | uint16 | undefined |

### setMaxBounty

```solidity
function setMaxBounty() external nonpayable
```

See {IHATVault-setMaxBounty}. 




### setPendingMaxBounty

```solidity
function setPendingMaxBounty(uint16 _maxBounty) external nonpayable
```

See {IHATVault-setPendingMaxBounty}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _maxBounty | uint16 | undefined |

### setVaultDescription

```solidity
function setVaultDescription(string _descriptionHash) external nonpayable
```

See {IHATVault-setVaultDescription}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _descriptionHash | string | undefined |

### setVestingParams

```solidity
function setVestingParams(uint32 _duration, uint32 _periods) external nonpayable
```

See {IHATVault-setVestingParams}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _duration | uint32 | undefined |
| _periods | uint32 | undefined |

### setWithdrawalFee

```solidity
function setWithdrawalFee(uint256 _fee) external nonpayable
```

See {IHATVault-setWithdrawalFee}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _fee | uint256 | undefined |

### submitClaim

```solidity
function submitClaim(address _beneficiary, uint16 _bountyPercentage, string _descriptionHash) external nonpayable returns (bytes32 claimId)
```

See {IHATVault-submitClaim}. 



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

### symbol

```solidity
function symbol() external view returns (string)
```



*Returns the symbol of the token, usually a shorter version of the name.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | string | undefined |

### tokenLockFactory

```solidity
function tokenLockFactory() external view returns (contract ITokenLockFactory)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract ITokenLockFactory | undefined |

### totalAssets

```solidity
function totalAssets() external view returns (uint256)
```



*See {IERC4626-totalAssets}. *


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### totalSupply

```solidity
function totalSupply() external view returns (uint256)
```



*See {IERC20-totalSupply}.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### transfer

```solidity
function transfer(address to, uint256 amount) external nonpayable returns (bool)
```



*See {IERC20-transfer}. Requirements: - `to` cannot be the zero address. - the caller must have a balance of at least `amount`.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| to | address | undefined |
| amount | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### transferFrom

```solidity
function transferFrom(address from, address to, uint256 amount) external nonpayable returns (bool)
```



*See {IERC20-transferFrom}. Emits an {Approval} event indicating the updated allowance. This is not required by the EIP. See the note at the beginning of {ERC20}. NOTE: Does not update the allowance if the current allowance is the maximum `uint256`. Requirements: - `from` and `to` cannot be the zero address. - `from` must have a balance of at least `amount`. - the caller must have allowance for ``from``&#39;s tokens of at least `amount`.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| from | address | undefined |
| to | address | undefined |
| amount | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### transferOwnership

```solidity
function transferOwnership(address newOwner) external nonpayable
```



*Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| newOwner | address | undefined |

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

### withdraw

```solidity
function withdraw(uint256 assets, address receiver, address owner, uint256 maxShares) external nonpayable returns (uint256)
```

See {IHATVault-withdraw}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| assets | uint256 | undefined |
| receiver | address | undefined |
| owner | address | undefined |
| maxShares | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### withdraw

```solidity
function withdraw(uint256 assets, address receiver, address owner) external nonpayable returns (uint256)
```

See {IHATVault-withdraw}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| assets | uint256 | undefined |
| receiver | address | undefined |
| owner | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### withdrawAndClaim

```solidity
function withdrawAndClaim(uint256 assets, address receiver, address owner, uint256 maxShares) external nonpayable returns (uint256 shares)
```

See {IHATVault-withdrawAndClaim}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| assets | uint256 | undefined |
| receiver | address | undefined |
| owner | address | undefined |
| maxShares | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| shares | uint256 | undefined |

### withdrawAndClaim

```solidity
function withdrawAndClaim(uint256 assets, address receiver, address owner) external nonpayable returns (uint256 shares)
```

See {IHATVault-withdrawAndClaim}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| assets | uint256 | undefined |
| receiver | address | undefined |
| owner | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| shares | uint256 | undefined |

### withdrawEnableStartTime

```solidity
function withdrawEnableStartTime(address) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### withdrawRequest

```solidity
function withdrawRequest() external nonpayable
```

See {IHATVault-withdrawRequest}. 




### withdrawalFee

```solidity
function withdrawalFee() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |



## Events

### AddRewardController

```solidity
event AddRewardController(contract IRewardController indexed _newRewardController)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _newRewardController `indexed` | contract IRewardController | undefined |

### Approval

```solidity
event Approval(address indexed owner, address indexed spender, uint256 value)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| owner `indexed` | address | undefined |
| spender `indexed` | address | undefined |
| value  | uint256 | undefined |

### ApproveClaim

```solidity
event ApproveClaim(bytes32 indexed _claimId, address indexed _committee, address indexed _beneficiary, uint256 _bountyPercentage, address _tokenLock, IHATVault.ClaimBounty _claimBounty)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId `indexed` | bytes32 | undefined |
| _committee `indexed` | address | undefined |
| _beneficiary `indexed` | address | undefined |
| _bountyPercentage  | uint256 | undefined |
| _tokenLock  | address | undefined |
| _claimBounty  | IHATVault.ClaimBounty | undefined |

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






### Deposit

```solidity
event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| sender `indexed` | address | undefined |
| owner `indexed` | address | undefined |
| assets  | uint256 | undefined |
| shares  | uint256 | undefined |

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
event SetBountySplit(IHATVault.BountySplit _bountySplit)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _bountySplit  | IHATVault.BountySplit | undefined |

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

### SetDepositPause

```solidity
event SetDepositPause(bool _depositPause)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _depositPause  | bool | undefined |

### SetHATBountySplit

```solidity
event SetHATBountySplit(uint256 _bountyGovernanceHAT, uint256 _bountyHackerHATVested)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _bountyGovernanceHAT  | uint256 | undefined |
| _bountyHackerHATVested  | uint256 | undefined |

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

### SetVaultDescription

```solidity
event SetVaultDescription(string _descriptionHash)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _descriptionHash  | string | undefined |

### SetVestingParams

```solidity
event SetVestingParams(uint256 _duration, uint256 _periods)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _duration  | uint256 | undefined |
| _periods  | uint256 | undefined |

### SetWithdrawalFee

```solidity
event SetWithdrawalFee(uint256 _newFee)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _newFee  | uint256 | undefined |

### SubmitClaim

```solidity
event SubmitClaim(bytes32 indexed _claimId, address indexed _committee, address indexed _beneficiary, uint256 _bountyPercentage, string _descriptionHash)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId `indexed` | bytes32 | undefined |
| _committee `indexed` | address | undefined |
| _beneficiary `indexed` | address | undefined |
| _bountyPercentage  | uint256 | undefined |
| _descriptionHash  | string | undefined |

### Transfer

```solidity
event Transfer(address indexed from, address indexed to, uint256 value)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| from `indexed` | address | undefined |
| to `indexed` | address | undefined |
| value  | uint256 | undefined |

### VaultDestroyed

```solidity
event VaultDestroyed()
```






### Withdraw

```solidity
event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| sender `indexed` | address | undefined |
| receiver `indexed` | address | undefined |
| owner `indexed` | address | undefined |
| assets  | uint256 | undefined |
| shares  | uint256 | undefined |

### WithdrawRequest

```solidity
event WithdrawRequest(address indexed _beneficiary, uint256 _withdrawEnableTime)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _beneficiary `indexed` | address | undefined |
| _withdrawEnableTime  | uint256 | undefined |



## Errors

### ActiveClaimExists

```solidity
error ActiveClaimExists()
```






### AmountCannotBeZero

```solidity
error AmountCannotBeZero()
```






### AmountOfSharesMustBeMoreThanMinimalAmount

```solidity
error AmountOfSharesMustBeMoreThanMinimalAmount()
```






### BountyPercentageHigherThanMaxBounty

```solidity
error BountyPercentageHigherThanMaxBounty()
```






### CannotSetToPerviousRewardController

```solidity
error CannotSetToPerviousRewardController()
```






### CannotTransferToAnotherUserWithActiveWithdrawRequest

```solidity
error CannotTransferToAnotherUserWithActiveWithdrawRequest()
```






### CannotTransferToSelf

```solidity
error CannotTransferToSelf()
```






### CannotUnpauseDestroyedVault

```solidity
error CannotUnpauseDestroyedVault()
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






### CommitteeNotCheckedInYet

```solidity
error CommitteeNotCheckedInYet()
```






### DelayPeriodForSettingMaxBountyHadNotPassed

```solidity
error DelayPeriodForSettingMaxBountyHadNotPassed()
```






### DepositSlippageProtection

```solidity
error DepositSlippageProtection()
```






### DuplicatedRewardController

```solidity
error DuplicatedRewardController()
```






### MaxBountyCannotBeMoreThanMaxBountyLimit

```solidity
error MaxBountyCannotBeMoreThanMaxBountyLimit()
```






### MintSlippageProtection

```solidity
error MintSlippageProtection()
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






### OnlyFeeSetter

```solidity
error OnlyFeeSetter()
```






### OnlyRegistryOwner

```solidity
error OnlyRegistryOwner()
```






### PayoutMustBeUpToMaxBountyLimitOrHundredPercent

```solidity
error PayoutMustBeUpToMaxBountyLimitOrHundredPercent()
```






### RedeemMoreThanMax

```solidity
error RedeemMoreThanMax()
```






### RedeemSlippageProtection

```solidity
error RedeemSlippageProtection()
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






### WithdrawMustBeGreaterThanZero

```solidity
error WithdrawMustBeGreaterThanZero()
```






### WithdrawSlippageProtection

```solidity
error WithdrawSlippageProtection()
```






### WithdrawalFeeTooBig

```solidity
error WithdrawalFeeTooBig()
```







