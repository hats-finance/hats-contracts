# HATVault

*Hats.finance*

> A Hats.finance vault which holds the funds for a specific project&#39;s bug bounties

The HATVault can be deposited into in a permissionless manner using the vault’s native token. Anyone can deposit the vault&#39;s native token into the vault and  recieve shares for it. Shares represent the user&#39;s relative part in the vault, and when a bounty is paid out, users lose part of their deposits (based on percentage paid), but keep their share of the vault. Users also receive rewards for their deposits, which can be claimed at any time. To withdraw previously deposited tokens, a user must first send a withdraw request, and the withdrawal will be made available after a pending period. Withdrawals are not permitted during safety periods or while there is an  active claim for a bounty payout. This project is open-source and can be found at: https://github.com/hats-finance/hats-contracts



## Methods

### HUNDRED_PERCENT

```solidity
function HUNDRED_PERCENT() external view returns (uint256)
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

### claimsManager

```solidity
function claimsManager() external view returns (address)
```

Returns the vault&#39;s registry




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | The registry&#39;s address |

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

### destroyVault

```solidity
function destroyVault() external nonpayable
```

See {IHATVault-destroyVault}. 




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
function initialize(address _claimsManager, IHATVault.VaultInitParams _params) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _claimsManager | address | undefined |
| _params | IHATVault.VaultInitParams | undefined |

### makePayout

```solidity
function makePayout(uint256 _amount) external nonpayable
```

See {IHATVault-approveClaim}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _amount | uint256 | undefined |

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
function registry() external view returns (contract IHATVaultsRegistry)
```

Returns the vault&#39;s registry




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IHATVaultsRegistry | The registry&#39;s address |

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

### setDepositPause

```solidity
function setDepositPause(bool _depositPause) external nonpayable
```

See {IHATVault-setDepositPause}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _depositPause | bool | undefined |

### setVaultDescription

```solidity
function setVaultDescription(string _descriptionHash) external nonpayable
```

See {IHATVault-setVaultDescription}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _descriptionHash | string | undefined |

### setWithdrawPaused

```solidity
function setWithdrawPaused(bool _withdrawPaused) external nonpayable
```

See {IHATVault-setWithdrawPaused}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _withdrawPaused | bool | undefined |

### setWithdrawalFee

```solidity
function setWithdrawalFee(uint256 _fee) external nonpayable
```

See {IHATVault-setWithdrawalFee}. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _fee | uint256 | undefined |

### startVault

```solidity
function startVault() external nonpayable
```

See {IHATVault-destroyVault}. 




### symbol

```solidity
function symbol() external view returns (string)
```



*Returns the symbol of the token, usually a shorter version of the name.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | string | undefined |

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

### vaultStarted

```solidity
function vaultStarted() external view returns (bool)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

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

### withdrawPaused

```solidity
function withdrawPaused() external view returns (bool)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

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

### SetDepositPause

```solidity
event SetDepositPause(bool _depositPause)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _depositPause  | bool | undefined |

### SetVaultDescription

```solidity
event SetVaultDescription(string _descriptionHash)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _descriptionHash  | string | undefined |

### SetWithdrawPaused

```solidity
event SetWithdrawPaused(bool _withdrawPaused)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _withdrawPaused  | bool | undefined |

### SetWithdrawalFee

```solidity
event SetWithdrawalFee(uint256 _newFee)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _newFee  | uint256 | undefined |

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






### VaultPayout

```solidity
event VaultPayout(uint256 _amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _amount  | uint256 | undefined |

### VaultStarted

```solidity
event VaultStarted()
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

### AmountCannotBeZero

```solidity
error AmountCannotBeZero()
```






### AmountOfSharesMustBeMoreThanMinimalAmount

```solidity
error AmountOfSharesMustBeMoreThanMinimalAmount()
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






### DepositSlippageProtection

```solidity
error DepositSlippageProtection()
```






### DuplicatedRewardController

```solidity
error DuplicatedRewardController()
```






### MintSlippageProtection

```solidity
error MintSlippageProtection()
```






### OnlyClaimsManager

```solidity
error OnlyClaimsManager()
```






### OnlyFeeSetter

```solidity
error OnlyFeeSetter()
```






### OnlyRegistryOwner

```solidity
error OnlyRegistryOwner()
```






### RedeemMoreThanMax

```solidity
error RedeemMoreThanMax()
```






### RedeemSlippageProtection

```solidity
error RedeemSlippageProtection()
```






### SystemInEmergencyPause

```solidity
error SystemInEmergencyPause()
```






### VaultNotStartedYet

```solidity
error VaultNotStartedYet()
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







