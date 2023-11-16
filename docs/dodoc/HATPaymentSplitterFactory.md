# HATPaymentSplitterFactory









## Methods

### createHATPaymentSplitter

```solidity
function createHATPaymentSplitter(address[] _payees, uint256[] _shares) external nonpayable returns (address result)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _payees | address[] | undefined |
| _shares | uint256[] | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| result | address | undefined |

### implementation

```solidity
function implementation() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### predictSplitterAddress

```solidity
function predictSplitterAddress(address[] _payees, uint256[] _shares) external view returns (address)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _payees | address[] | undefined |
| _shares | uint256[] | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |



## Events

### HATPaymentSplitterCreated

```solidity
event HATPaymentSplitterCreated(address indexed _hatPaymentSplitter)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _hatPaymentSplitter `indexed` | address | undefined |



## Errors

### ArrayLengthMismatch

```solidity
error ArrayLengthMismatch()
```






### DulpicatedPayee

```solidity
error DulpicatedPayee()
```






### NoPayees

```solidity
error NoPayees()
```






### ZeroAddress

```solidity
error ZeroAddress()
```






### ZeroShares

```solidity
error ZeroShares()
```







