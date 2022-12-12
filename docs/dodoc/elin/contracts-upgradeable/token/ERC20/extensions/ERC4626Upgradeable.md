# ERC4626Upgradeable







*Implementation of the ERC4626 &quot;Tokenized Vault Standard&quot; as defined in https://eips.ethereum.org/EIPS/eip-4626[EIP-4626]. This extension allows the minting and burning of &quot;shares&quot; (represented using the ERC20 inheritance) in exchange for underlying &quot;assets&quot; through standardized {deposit}, {mint}, {redeem} and {burn} workflows. This contract extends the ERC20 standard. Any additional extensions included along it would affect the &quot;shares&quot; token represented by this contract and not the &quot;assets&quot; token which is an independent contract. CAUTION: Deposits and withdrawals may incur unexpected slippage. Users should verify that the amount received of shares or assets is as expected. EOAs should operate through a wrapper that performs these checks such as https://github.com/fei-protocol/ERC4626#erc4626router-and-base[ERC4626Router]. _Available since v4.7._*

## Methods

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



*See {IERC4262-asset}. *


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

### convertToAssets

```solidity
function convertToAssets(uint256 shares) external view returns (uint256 assets)
```



*See {IERC4262-convertToAssets}. *

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



*See {IERC4262-convertToShares}. *

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



*Returns the number of decimals used to get its user representation. For example, if `decimals` equals `2`, a balance of `505` tokens should be displayed to a user as `5.05` (`505 / 10 ** 2`). Tokens usually opt for a value of 18, imitating the relationship between Ether and Wei. This is the value {ERC20} uses, unless this function is overridden; NOTE: This information is only used for _display_ purposes: it in no way affects any of the arithmetic of the contract, including {IERC20-balanceOf} and {IERC20-transfer}.*


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



*See {IERC4262-deposit}. *

#### Parameters

| Name | Type | Description |
|---|---|---|
| assets | uint256 | undefined |
| receiver | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

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

### maxDeposit

```solidity
function maxDeposit(address) external view returns (uint256)
```



*See {IERC4262-maxDeposit}. *

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



*See {IERC4262-maxMint}. *

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



*See {IERC4262-maxRedeem}. *

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



*See {IERC4262-maxWithdraw}. *

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
function mint(uint256 shares, address receiver) external nonpayable returns (uint256)
```



*See {IERC4262-mint}. *

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

### previewDeposit

```solidity
function previewDeposit(uint256 assets) external view returns (uint256)
```



*See {IERC4262-previewDeposit}. *

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



*See {IERC4262-previewMint}. *

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
function previewRedeem(uint256 shares) external view returns (uint256)
```



*See {IERC4262-previewRedeem}. *

#### Parameters

| Name | Type | Description |
|---|---|---|
| shares | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### previewWithdraw

```solidity
function previewWithdraw(uint256 assets) external view returns (uint256)
```



*See {IERC4262-previewWithdraw}. *

#### Parameters

| Name | Type | Description |
|---|---|---|
| assets | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### redeem

```solidity
function redeem(uint256 shares, address receiver, address owner) external nonpayable returns (uint256)
```



*See {IERC4262-redeem}. *

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



*See {IERC4262-totalAssets}. *


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

### withdraw

```solidity
function withdraw(uint256 assets, address receiver, address owner) external nonpayable returns (uint256)
```



*See {IERC4262-withdraw}. *

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



## Events

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
event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| caller `indexed` | address | undefined |
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

### Withdraw

```solidity
event Withdraw(address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| caller `indexed` | address | undefined |
| receiver `indexed` | address | undefined |
| owner `indexed` | address | undefined |
| assets  | uint256 | undefined |
| shares  | uint256 | undefined |



