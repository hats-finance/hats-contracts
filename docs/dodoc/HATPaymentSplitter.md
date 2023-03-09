# HATPaymentSplitter









## Methods

### initialize

```solidity
function initialize(address[] _payees, uint256[] _shares) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _payees | address[] | undefined |
| _shares | uint256[] | undefined |

### payee

```solidity
function payee(uint256 index) external view returns (address)
```



*Getter for the address of the payee number `index`.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| index | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### releasable

```solidity
function releasable(address account) external view returns (uint256)
```



*Getter for the amount of payee&#39;s releasable Ether.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### releasable

```solidity
function releasable(contract IERC20Upgradeable token, address account) external view returns (uint256)
```



*Getter for the amount of payee&#39;s releasable `token` tokens. `token` should be the address of an IERC20 contract.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| token | contract IERC20Upgradeable | undefined |
| account | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### release

```solidity
function release(address payable account) external nonpayable
```



*Triggers a transfer to `account` of the amount of Ether they are owed, according to their percentage of the total shares and their previous withdrawals.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address payable | undefined |

### release

```solidity
function release(contract IERC20Upgradeable token, address account) external nonpayable
```



*Triggers a transfer to `account` of the amount of `token` tokens they are owed, according to their percentage of the total shares and their previous withdrawals. `token` must be the address of an IERC20 contract.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| token | contract IERC20Upgradeable | undefined |
| account | address | undefined |

### releaseFromTokenLock

```solidity
function releaseFromTokenLock(contract ITokenLock _tokenLock) external nonpayable
```

Releases tokens from a tokenlock contract



#### Parameters

| Name | Type | Description |
|---|---|---|
| _tokenLock | contract ITokenLock | The tokenlock to release from |

### released

```solidity
function released(contract IERC20Upgradeable token, address account) external view returns (uint256)
```



*Getter for the amount of `token` tokens already released to a payee. `token` should be the address of an IERC20 contract.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| token | contract IERC20Upgradeable | undefined |
| account | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### released

```solidity
function released(address account) external view returns (uint256)
```



*Getter for the amount of Ether already released to a payee.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### shares

```solidity
function shares(address account) external view returns (uint256)
```



*Getter for the amount of shares held by an account.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### sweepTokenFromTokenLock

```solidity
function sweepTokenFromTokenLock(contract ITokenLock _tokenLock, contract IERC20 _token) external nonpayable
```

Sweeps out accidentally sent tokens from a tokenlock contract



#### Parameters

| Name | Type | Description |
|---|---|---|
| _tokenLock | contract ITokenLock | The tokenlock to call sweepToken on |
| _token | contract IERC20 | Address of token to sweep |

### totalReleased

```solidity
function totalReleased(contract IERC20Upgradeable token) external view returns (uint256)
```



*Getter for the total amount of `token` already released. `token` should be the address of an IERC20 contract.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| token | contract IERC20Upgradeable | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### totalReleased

```solidity
function totalReleased() external view returns (uint256)
```



*Getter for the total amount of Ether already released.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### totalShares

```solidity
function totalShares() external view returns (uint256)
```



*Getter for the total shares held by payees.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### withdrawSurplusFromTokenLock

```solidity
function withdrawSurplusFromTokenLock(contract ITokenLock _tokenLock, uint256 _amount) external nonpayable
```

Withdraws surplus, unmanaged tokens from a tokenlock contract



#### Parameters

| Name | Type | Description |
|---|---|---|
| _tokenLock | contract ITokenLock | The tokenlock to withdraw surplus from |
| _amount | uint256 | Amount of tokens to withdraw |



## Events

### ERC20PaymentReleased

```solidity
event ERC20PaymentReleased(contract IERC20Upgradeable indexed token, address to, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| token `indexed` | contract IERC20Upgradeable | undefined |
| to  | address | undefined |
| amount  | uint256 | undefined |

### Initialized

```solidity
event Initialized(uint8 version)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| version  | uint8 | undefined |

### PayeeAdded

```solidity
event PayeeAdded(address account, uint256 shares)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| account  | address | undefined |
| shares  | uint256 | undefined |

### PaymentReceived

```solidity
event PaymentReceived(address from, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| from  | address | undefined |
| amount  | uint256 | undefined |

### PaymentReleased

```solidity
event PaymentReleased(address to, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| to  | address | undefined |
| amount  | uint256 | undefined |



