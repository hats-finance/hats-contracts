# IHATVault

*Hats.finance*

> Interface for Hats.finance Vaults

A HATVault holds the funds for a specific project&#39;s bug bounties. Anyone can permissionlessly deposit into the HATVault using the vault’s native token. When a bug is submitted and approved, the bounty  is paid out using the funds in the vault. Bounties are paid out as a percentage of the vault. The percentage is set according to the severity of the bug. Vaults have regular safety periods (typically for an hour twice a day) which are time for the committee to make decisions. In addition to the roles defined in the HATVaultsRegistry, every HATVault  has the roles: Committee - The only address which can submit a claim for a bounty payout and set the maximum bounty. User - Anyone can deposit the vault&#39;s native token into the vault and  recieve shares for it. Shares represent the user&#39;s relative part in the vault, and when a bounty is paid out, users lose part of their deposits (based on percentage paid), but keep their share of the vault. Users also receive rewards for their deposits, which can be claimed at any  time. To withdraw previously deposited tokens, a user must first send a withdraw request, and the withdrawal will be made available after a pending period. Withdrawals are not permitted during safety periods or while there is an  active claim for a bounty payout. Bounties are payed out distributed between a few channels, and that  distribution is set upon creation (the hacker gets part in direct transfer, part in vested reward and part in vested HAT token, part gets rewarded to the committee, part gets swapped to HAT token and burned and/or sent to Hats governance). NOTE: Vaults should not use tokens which do not guarantee that the amount specified is the amount transferred This project is open-source and can be found at: https://github.com/hats-finance/hats-contracts



## Methods

### addRewardController

```solidity
function addRewardController(contract IRewardController _newRewardController) external nonpayable
```

Called by the registry&#39;s owner to add a reward controller to the vault



#### Parameters

| Name | Type | Description |
|---|---|---|
| _newRewardController | contract IRewardController | The new reward controller to add |

### allowance

```solidity
function allowance(address owner, address spender) external view returns (uint256)
```



*Returns the remaining number of tokens that `spender` will be allowed to spend on behalf of `owner` through {transferFrom}. This is zero by default. This value changes when {approve} or {transferFrom} are called.*

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



*Sets `amount` as the allowance of `spender` over the caller&#39;s tokens. Returns a boolean value indicating whether the operation succeeded. IMPORTANT: Beware that changing an allowance with this method brings the risk that someone may use both the old and the new allowance by unfortunate transaction ordering. One possible solution to mitigate this race condition is to first reduce the spender&#39;s allowance to 0 and set the desired value afterwards: https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729 Emits an {Approval} event.*

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

Approve a claim for a bounty submitted by a committee, and pay out bounty to hacker and committee. Also transfer to the  HATVaultsRegistry the part of the bounty that will be swapped to HAT  tokens. If the claim had been previously challenged, this is only callable by the arbitrator. Otherwise, callable by anyone after challengePeriod had passed.



#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId | bytes32 | The claim ID |
| _bountyPercentage | uint16 | The percentage of the vault&#39;s balance that will be sent as a bounty. This value will be ignored if the caller is not the arbitrator. |
| _beneficiary | address | where the bounty will be sent to. This value will be  ignored if the caller is not the arbitrator. |

### asset

```solidity
function asset() external view returns (address assetTokenAddress)
```



*Returns the address of the underlying token used for the Vault for accounting, depositing, and withdrawing. - MUST be an ERC-20 token contract. - MUST NOT revert.*


#### Returns

| Name | Type | Description |
|---|---|---|
| assetTokenAddress | address | undefined |

### balanceOf

```solidity
function balanceOf(address account) external view returns (uint256)
```



*Returns the amount of tokens owned by `account`.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

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




### convertToAssets

```solidity
function convertToAssets(uint256 shares) external view returns (uint256 assets)
```



*Returns the amount of assets that the Vault would exchange for the amount of shares provided, in an ideal scenario where all the conditions are met. - MUST NOT be inclusive of any fees that are charged against assets in the Vault. - MUST NOT show any variations depending on the caller. - MUST NOT reflect slippage or other on-chain conditions, when performing the actual exchange. - MUST NOT revert. NOTE: This calculation MAY NOT reflect the “per-user” price-per-share, and instead should reflect the “average-user’s” price-per-share, meaning what the average user should expect to see when exchanging to and from.*

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



*Returns the amount of shares that the Vault would exchange for the amount of assets provided, in an ideal scenario where all the conditions are met. - MUST NOT be inclusive of any fees that are charged against assets in the Vault. - MUST NOT show any variations depending on the caller. - MUST NOT reflect slippage or other on-chain conditions, when performing the actual exchange. - MUST NOT revert. NOTE: This calculation MAY NOT reflect the “per-user” price-per-share, and instead should reflect the “average-user’s” price-per-share, meaning what the average user should expect to see when exchanging to and from.*

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



*Returns the decimals places of the token.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint8 | undefined |

### deposit

```solidity
function deposit(uint256 assets, address receiver) external nonpayable returns (uint256)
```



*Deposit funds to the vault. Can only be called if the committee had checked in and deposits are not paused, and the registry is not in an emergency pause.See {IERC4626-deposit}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| assets | uint256 | Amount of vault&#39;s native token to deposit |
| receiver | address | Reciever of the shares from the deposit |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### deposit

```solidity
function deposit(uint256 assets, address receiver, uint256 minShares) external nonpayable returns (uint256)
```



*Deposit funds to the vault. Can only be called if the committee had checked in and deposits are not paused, and the registry is not in an emergency pause. Allows to specify minimum shares to be minted for slippage protection.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| assets | uint256 | Amount of vault&#39;s native token to deposit |
| receiver | address | Reciever of the shares from the deposit |
| minShares | uint256 | Minimum amount of shares to minted for the assets |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### dismissClaim

```solidity
function dismissClaim(bytes32 _claimId) external nonpayable
```

Dismiss the active claim for bounty payout submitted by the committee. Called either by the arbitrator, or by anyone if the claim has timed out.



#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimId | bytes32 | The claim ID |

### emergencyWithdraw

```solidity
function emergencyWithdraw(address receiver) external nonpayable returns (uint256 assets)
```

Redeem all of the user&#39;s shares in the vault for the respective amount of underlying assets without calling the reward controller, meaning user renounces their uncommited part of the reward. Can only be performed if a withdraw request has been previously submitted, and the pending period had passed, and while the withdraw enabled timeout had not passed. Withdrawals are not permitted during safety periods or while there is an active claim for a bounty payout.



#### Parameters

| Name | Type | Description |
|---|---|---|
| receiver | address | Address of receiver of the funds  |

#### Returns

| Name | Type | Description |
|---|---|---|
| assets | uint256 | undefined |

### getArbitrator

```solidity
function getArbitrator() external view returns (address)
```

Returns the address of the vault&#39;s arbitrator If no specific value for this vault has been set, the registry&#39;s default value will be returned.




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | The address of the vault&#39;s arbitrator |

### getBountyGovernanceHAT

```solidity
function getBountyGovernanceHAT() external view returns (uint16)
```

Returns the vault HAT bounty split part that goes to the governance If no specific value for this vault has been set, the registry&#39;s default value will be returned.




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint16 | The vault&#39;s HAT bounty split part that goes to the governance |

### getBountyHackerHATVested

```solidity
function getBountyHackerHATVested() external view returns (uint16)
```

Returns the vault HAT bounty split part that is vested for the hacker If no specific value for this vault has been set, the registry&#39;s default value will be returned.




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint16 | The vault&#39;s HAT bounty split part that is vested for the hacker |

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

### initialize

```solidity
function initialize(IHATVault.VaultInitParams _params) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _params | IHATVault.VaultInitParams | undefined |

### maxDeposit

```solidity
function maxDeposit(address receiver) external view returns (uint256 maxAssets)
```



*Returns the maximum amount of the underlying asset that can be deposited into the Vault for the receiver, through a deposit call. - MUST return a limited value if receiver is subject to some deposit limit. - MUST return 2 ** 256 - 1 if there is no limit on the maximum amount of assets that may be deposited. - MUST NOT revert.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| receiver | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| maxAssets | uint256 | undefined |

### maxMint

```solidity
function maxMint(address receiver) external view returns (uint256 maxShares)
```



*Returns the maximum amount of the Vault shares that can be minted for the receiver, through a mint call. - MUST return a limited value if receiver is subject to some mint limit. - MUST return 2 ** 256 - 1 if there is no limit on the maximum amount of shares that may be minted. - MUST NOT revert.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| receiver | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| maxShares | uint256 | undefined |

### maxRedeem

```solidity
function maxRedeem(address owner) external view returns (uint256 maxShares)
```



*Returns the maximum amount of Vault shares that can be redeemed from the owner balance in the Vault, through a redeem call. - MUST return a limited value if owner is subject to some withdrawal limit or timelock. - MUST return balanceOf(owner) if owner is not subject to any withdrawal limit or timelock. - MUST NOT revert.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| owner | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| maxShares | uint256 | undefined |

### maxWithdraw

```solidity
function maxWithdraw(address owner) external view returns (uint256 maxAssets)
```



*Returns the maximum amount of the underlying asset that can be withdrawn from the owner balance in the Vault, through a withdraw call. - MUST return a limited value if owner is subject to some withdrawal limit or timelock. - MUST NOT revert.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| owner | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| maxAssets | uint256 | undefined |

### mint

```solidity
function mint(uint256 shares, address receiver, uint256 maxAssets) external nonpayable returns (uint256)
```



*Deposit funds to the vault based on the amount of shares to mint specified. Can only be called if the committee had checked in and deposits are not paused, and the registry is not in an emergency pause. Allows to specify maximum assets to be deposited for slippage protection.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| shares | uint256 | Amount of vault&#39;s shares to mint |
| receiver | address | Reciever of the shares from the deposit |
| maxAssets | uint256 | Maximum amount of assets to deposit for the shares |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### mint

```solidity
function mint(uint256 shares, address receiver) external nonpayable returns (uint256 assets)
```



*Mints exactly shares Vault shares to receiver by depositing amount of underlying tokens. - MUST emit the Deposit event. - MAY support an additional flow in which the underlying tokens are owned by the Vault contract before the mint   execution, and are accounted for during mint. - MUST revert if all of shares cannot be minted (due to deposit limit being reached, slippage, the user not   approving enough underlying tokens to the Vault contract, etc). NOTE: most implementations will require pre-approval of the Vault with the Vault’s underlying asset token.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| shares | uint256 | undefined |
| receiver | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| assets | uint256 | undefined |

### name

```solidity
function name() external view returns (string)
```



*Returns the name of the token.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | string | undefined |

### previewDeposit

```solidity
function previewDeposit(uint256 assets) external view returns (uint256 shares)
```



*Allows an on-chain or off-chain user to simulate the effects of their deposit at the current block, given current on-chain conditions. - MUST return as close to and no more than the exact amount of Vault shares that would be minted in a deposit   call in the same transaction. I.e. deposit should return the same or more shares as previewDeposit if called   in the same transaction. - MUST NOT account for deposit limits like those returned from maxDeposit and should always act as though the   deposit would be accepted, regardless if the user has enough tokens approved, etc. - MUST be inclusive of deposit fees. Integrators should be aware of the existence of deposit fees. - MUST NOT revert. NOTE: any unfavorable discrepancy between convertToShares and previewDeposit SHOULD be considered slippage in share price or some other type of condition, meaning the depositor will lose assets by depositing.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| assets | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| shares | uint256 | undefined |

### previewMint

```solidity
function previewMint(uint256 shares) external view returns (uint256 assets)
```



*Allows an on-chain or off-chain user to simulate the effects of their mint at the current block, given current on-chain conditions. - MUST return as close to and no fewer than the exact amount of assets that would be deposited in a mint call   in the same transaction. I.e. mint should return the same or fewer assets as previewMint if called in the   same transaction. - MUST NOT account for mint limits like those returned from maxMint and should always act as though the mint   would be accepted, regardless if the user has enough tokens approved, etc. - MUST be inclusive of deposit fees. Integrators should be aware of the existence of deposit fees. - MUST NOT revert. NOTE: any unfavorable discrepancy between convertToAssets and previewMint SHOULD be considered slippage in share price or some other type of condition, meaning the depositor will lose assets by minting.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| shares | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| assets | uint256 | undefined |

### previewRedeem

```solidity
function previewRedeem(uint256 shares) external view returns (uint256 assets)
```



*Allows an on-chain or off-chain user to simulate the effects of their redeemption at the current block, given current on-chain conditions. - MUST return as close to and no more than the exact amount of assets that would be withdrawn in a redeem call   in the same transaction. I.e. redeem should return the same or more assets as previewRedeem if called in the   same transaction. - MUST NOT account for redemption limits like those returned from maxRedeem and should always act as though the   redemption would be accepted, regardless if the user has enough shares, etc. - MUST be inclusive of withdrawal fees. Integrators should be aware of the existence of withdrawal fees. - MUST NOT revert. NOTE: any unfavorable discrepancy between convertToAssets and previewRedeem SHOULD be considered slippage in share price or some other type of condition, meaning the depositor will lose assets by redeeming.*

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

Returns the amount of assets to be sent to the user for the exact amount of shares to redeem. Also returns the amount assets to be paid as fee.



#### Parameters

| Name | Type | Description |
|---|---|---|
| shares | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| assets | uint256 | amount of assets to be sent in exchange for the amount of shares specified |
| fee | uint256 | The amount of assets that will be paid as fee |

### previewWithdraw

```solidity
function previewWithdraw(uint256 assets) external view returns (uint256 shares)
```



*Allows an on-chain or off-chain user to simulate the effects of their withdrawal at the current block, given current on-chain conditions. - MUST return as close to and no fewer than the exact amount of Vault shares that would be burned in a withdraw   call in the same transaction. I.e. withdraw should return the same or fewer shares as previewWithdraw if   called   in the same transaction. - MUST NOT account for withdrawal limits like those returned from maxWithdraw and should always act as though   the withdrawal would be accepted, regardless if the user has enough shares, etc. - MUST be inclusive of withdrawal fees. Integrators should be aware of the existence of withdrawal fees. - MUST NOT revert. NOTE: any unfavorable discrepancy between convertToShares and previewWithdraw SHOULD be considered slippage in share price or some other type of condition, meaning the depositor will lose assets by depositing.*

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

Returns the amount of shares to be burned to give the user the exact amount of assets requested plus cover for the fee. Also returns the amount assets to be paid as fee.



#### Parameters

| Name | Type | Description |
|---|---|---|
| assets | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| shares | uint256 | The amount of shares to be burned to get the requested amount of assets |
| fee | uint256 | The amount of assets that will be paid as fee |

### redeem

```solidity
function redeem(uint256 shares, address receiver, address owner, uint256 minAssets) external nonpayable returns (uint256)
```

Redeem shares in the vault for the respective amount of underlying assets, without transferring the accumulated reward. Can only be performed if a withdraw request has been previously submitted, and the pending period had passed, and while the withdraw enabled timeout had not passed. Withdrawals are not permitted during safety periods or while there is an active claim for a bounty payout. Allows to specify minimum assets to be received for slippage protection.



#### Parameters

| Name | Type | Description |
|---|---|---|
| shares | uint256 | Amount of shares to redeem |
| receiver | address | Address of receiver of the funds  |
| owner | address | Address of owner of the funds |
| minAssets | uint256 | Minimum amount of assets to receive for the shares |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### redeem

```solidity
function redeem(uint256 shares, address receiver, address owner) external nonpayable returns (uint256)
```

Redeem shares in the vault for the respective amount of underlying assets, without transferring the accumulated reward. Can only be performed if a withdraw request has been previously submitted, and the pending period had passed, and while the withdraw enabled timeout had not passed. Withdrawals are not permitted during safety periods or while there is an active claim for a bounty payout.

*See {IERC4626-redeem}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| shares | uint256 | Amount of shares to redeem |
| receiver | address | Address of receiver of the funds  |
| owner | address | Address of owner of the funds  |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### redeemAndClaim

```solidity
function redeemAndClaim(uint256 shares, address receiver, address owner, uint256 minAssets) external nonpayable returns (uint256 assets)
```

Redeem shares in the vault for the respective amount of underlying assets and claim the HAT reward that the user has earned. Can only be performed if a withdraw request has been previously submitted, and the pending period had passed, and while the withdraw enabled timeout had not passed. Withdrawals are not permitted during safety periods or while there is an active claim for a bounty payout. Allows to specify minimum assets to be received for slippage protection.

*See {IERC4626-redeem}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| shares | uint256 | Amount of shares to redeem |
| receiver | address | Address of receiver of the funds  |
| owner | address | Address of owner of the funds |
| minAssets | uint256 | Minimum amount of assets to receive for the shares |

#### Returns

| Name | Type | Description |
|---|---|---|
| assets | uint256 | undefined |

### redeemAndClaim

```solidity
function redeemAndClaim(uint256 shares, address receiver, address owner) external nonpayable returns (uint256 assets)
```

Redeem shares in the vault for the respective amount of underlying assets and claim the HAT reward that the user has earned. Can only be performed if a withdraw request has been previously submitted, and the pending period had passed, and while the withdraw enabled timeout had not passed. Withdrawals are not permitted during safety periods or while there is an active claim for a bounty payout.

*See {IERC4626-redeem}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| shares | uint256 | Amount of shares to redeem |
| receiver | address | Address of receiver of the funds  |
| owner | address | Address of owner of the funds  |

#### Returns

| Name | Type | Description |
|---|---|---|
| assets | uint256 | undefined |

### setArbitrator

```solidity
function setArbitrator(address _arbitrator) external nonpayable
```

Called by the registry&#39;s owner to set the vault arbitrator If the value passed is the special &quot;null&quot; value the vault will use the registry&#39;s default value.



#### Parameters

| Name | Type | Description |
|---|---|---|
| _arbitrator | address | The address of vault&#39;s arbitrator |

### setArbitratorCanChangeClaim

```solidity
function setArbitratorCanChangeClaim(enum IHATVault.ArbitratorCanChangeBounty _arbitratorCanChangeBounty, enum IHATVault.ArbitratorCanChangeBeneficiary _arbitratorCanChangeBeneficiary) external nonpayable
```

Called by the registry&#39;s owner to set whether the arbitrator can change a claim bounty percentage and/ or beneficiary If the value passed is the special &quot;null&quot; value the vault will use the registry&#39;s default value.



#### Parameters

| Name | Type | Description |
|---|---|---|
| _arbitratorCanChangeBounty | enum IHATVault.ArbitratorCanChangeBounty | Whether the arbitrator can change a claim bounty percentage |
| _arbitratorCanChangeBeneficiary | enum IHATVault.ArbitratorCanChangeBeneficiary | Whether the arbitrator can change a claim beneficiary |

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

### setDepositPause

```solidity
function setDepositPause(bool _depositPause) external nonpayable
```

Called by the vault&#39;s owner to disable all deposits to the vault



#### Parameters

| Name | Type | Description |
|---|---|---|
| _depositPause | bool | Are deposits paused |

### setHATBountySplit

```solidity
function setHATBountySplit(uint16 _bountyGovernanceHAT, uint16 _bountyHackerHATVested) external nonpayable
```

Called by the registry&#39;s owner to set the vault HAT token bounty  split upon an approval. If the value passed is the special &quot;null&quot; value the vault will use the registry&#39;s default value.



#### Parameters

| Name | Type | Description |
|---|---|---|
| _bountyGovernanceHAT | uint16 | The HAT bounty for governance |
| _bountyHackerHATVested | uint16 | The HAT bounty vested for the hacker |

### setMaxBounty

```solidity
function setMaxBounty() external nonpayable
```

Called by the vault&#39;s owner to set the vault&#39;s max bounty to the already pending max bounty. Cannot be called if there are active claims that have been submitted. Can only be called if there is a max bounty pending approval, and the time delay since setting the pending max bounty had passed.




### setPendingMaxBounty

```solidity
function setPendingMaxBounty(uint16 _maxBounty) external nonpayable
```

Called by the vault&#39;s owner to set a pending request for the maximum percentage of the vault that can be paid out as a bounty. Cannot be called if there is an active claim that has been submitted. Max bounty should be less than or equal to 90% (defined as 9000). It can also be set to 100%, but in this mode the vault will only allow payouts of the 100%, and the vault will become inactive forever afterwards. The pending value can be set by the owner after the time delay (of  {HATVaultsRegistry.generalParameters.setMaxBountyDelay}) had passed.



#### Parameters

| Name | Type | Description |
|---|---|---|
| _maxBounty | uint16 | The maximum bounty percentage that can be paid out |

### setVaultDescription

```solidity
function setVaultDescription(string _descriptionHash) external nonpayable
```

Called by the registry&#39;s owner to change the description of the vault in the Hats.finance UI



#### Parameters

| Name | Type | Description |
|---|---|---|
| _descriptionHash | string | the hash of the vault&#39;s description |

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

### setWithdrawalFee

```solidity
function setWithdrawalFee(uint256 _fee) external nonpayable
```

Called by the registry&#39;s fee setter to set the fee for  withdrawals from the vault.



#### Parameters

| Name | Type | Description |
|---|---|---|
| _fee | uint256 | The new fee. Must be smaller than or equal to `MAX_WITHDRAWAL_FEE` |

### submitClaim

```solidity
function submitClaim(address _beneficiary, uint16 _bountyPercentage, string _descriptionHash) external nonpayable returns (bytes32 claimId)
```

Called by the committee to submit a claim for a bounty payout. This function should be called only on a safety period, when withdrawals are disabled, and while there&#39;s no other active claim. Cannot be called when the registry is in an emergency pause. Upon a call to this function by the committee the vault&#39;s withdrawals will be disabled until the claim is approved or dismissed. Also from the time of this call the arbitrator will have a period of  {HATVaultsRegistry.challengePeriod} to challenge the claim.



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

### symbol

```solidity
function symbol() external view returns (string)
```



*Returns the symbol of the token.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | string | undefined |

### totalAssets

```solidity
function totalAssets() external view returns (uint256 totalManagedAssets)
```



*Returns the total amount of the underlying asset that is “managed” by Vault. - SHOULD include any compounding that occurs from yield. - MUST be inclusive of any fees that are charged against assets in the Vault. - MUST NOT revert.*


#### Returns

| Name | Type | Description |
|---|---|---|
| totalManagedAssets | uint256 | undefined |

### totalSupply

```solidity
function totalSupply() external view returns (uint256)
```



*Returns the amount of tokens in existence.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### transfer

```solidity
function transfer(address to, uint256 amount) external nonpayable returns (bool)
```



*Moves `amount` tokens from the caller&#39;s account to `to`. Returns a boolean value indicating whether the operation succeeded. Emits a {Transfer} event.*

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



*Moves `amount` tokens from `from` to `to` using the allowance mechanism. `amount` is then deducted from the caller&#39;s allowance. Returns a boolean value indicating whether the operation succeeded. Emits a {Transfer} event.*

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

### withdraw

```solidity
function withdraw(uint256 assets, address receiver, address owner, uint256 maxShares) external nonpayable returns (uint256)
```

Withdraw previously deposited funds from the vault, without transferring the accumulated HAT reward. Can only be performed if a withdraw request has been previously submitted, and the pending period had passed, and while the withdraw enabled timeout had not passed. Withdrawals are not permitted during safety periods or while there is an active claim for a bounty payout. Allows to specify maximum shares to be burnt for slippage protection.



#### Parameters

| Name | Type | Description |
|---|---|---|
| assets | uint256 | Amount of tokens to withdraw |
| receiver | address | Address of receiver of the funds  |
| owner | address | Address of owner of the funds |
| maxShares | uint256 | Maximum amount of shares to burn for the assets |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### withdraw

```solidity
function withdraw(uint256 assets, address receiver, address owner) external nonpayable returns (uint256)
```

Withdraw previously deposited funds from the vault, without transferring the accumulated rewards. Can only be performed if a withdraw request has been previously submitted, and the pending period had passed, and while the withdraw enabled timeout had not passed. Withdrawals are not permitted during safety periods or while there is an active claim for a bounty payout.

*See {IERC4626-withdraw}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| assets | uint256 | Amount of tokens to withdraw |
| receiver | address | Address of receiver of the funds  |
| owner | address | Address of owner of the funds  |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### withdrawAndClaim

```solidity
function withdrawAndClaim(uint256 assets, address receiver, address owner, uint256 maxShares) external nonpayable returns (uint256 shares)
```

Withdraw previously deposited funds from the vault and claim the HAT reward that the user has earned. Can only be performed if a withdraw request has been previously submitted, and the pending period had passed, and while the withdraw enabled timeout had not passed. Withdrawals are not permitted during safety periods or while there is an active claim for a bounty payout. Allows to specify maximum shares to be burnt for slippage protection.

*See {IERC4626-withdraw}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| assets | uint256 | Amount of tokens to withdraw |
| receiver | address | Address of receiver of the funds |
| owner | address | Address of owner of the funds |
| maxShares | uint256 | Maximum amount of shares to burn for the assets |

#### Returns

| Name | Type | Description |
|---|---|---|
| shares | uint256 | undefined |

### withdrawAndClaim

```solidity
function withdrawAndClaim(uint256 assets, address receiver, address owner) external nonpayable returns (uint256 shares)
```

Withdraw previously deposited funds from the vault and claim the HAT reward that the user has earned. Can only be performed if a withdraw request has been previously submitted, and the pending period had passed, and while the withdraw enabled timeout had not passed. Withdrawals are not permitted during safety periods or while there is an active claim for a bounty payout.

*See {IERC4626-withdraw}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| assets | uint256 | Amount of tokens to withdraw |
| receiver | address | Address of receiver of the funds |
| owner | address | Address of owner of the funds |

#### Returns

| Name | Type | Description |
|---|---|---|
| shares | uint256 | undefined |

### withdrawRequest

```solidity
function withdrawRequest() external nonpayable
```

Submit a request to withdraw funds from the vault. The request will only be approved if there is no previous active withdraw request. The request will be pending for a period of {HATVaultsRegistry.generalParameters.withdrawRequestPendingPeriod}, after which a withdraw will be possible for a duration of {HATVaultsRegistry.generalParameters.withdrawRequestEnablePeriod}






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

### SetArbitrator

```solidity
event SetArbitrator(address indexed _arbitrator)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _arbitrator `indexed` | address | undefined |

### SetArbitratorCanChangeClaim

```solidity
event SetArbitratorCanChangeClaim(enum IHATVault.ArbitratorCanChangeBounty _arbitratorCanChangeBounty, enum IHATVault.ArbitratorCanChangeBeneficiary _arbitratorCanChangeBeneficiary)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _arbitratorCanChangeBounty  | enum IHATVault.ArbitratorCanChangeBounty | undefined |
| _arbitratorCanChangeBeneficiary  | enum IHATVault.ArbitratorCanChangeBeneficiary | undefined |

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







