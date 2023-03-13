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

### nonce

```solidity
function nonce(address) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### predictNextSplitterAddress

```solidity
function predictNextSplitterAddress(address _deployer) external view returns (address)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _deployer | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### predictSplitterAddress

```solidity
function predictSplitterAddress(uint256 _nonce, address _deployer) external view returns (address)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _nonce | uint256 | undefined |
| _deployer | address | undefined |

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



