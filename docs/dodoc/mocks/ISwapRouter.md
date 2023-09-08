# ISwapRouter



> Router token swapping functionality

Functions for swapping tokens via Uniswap V3



## Methods

### WETH9

```solidity
function WETH9() external pure returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### exactInput

```solidity
function exactInput(ISwapRouter.ExactInputParams params) external payable returns (uint256 amountOut)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| params | ISwapRouter.ExactInputParams | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| amountOut | uint256 | undefined |

### exactInputSingle

```solidity
function exactInputSingle(ISwapRouter.ExactInputSingleParams params) external payable returns (uint256 amountOut)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| params | ISwapRouter.ExactInputSingleParams | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| amountOut | uint256 | undefined |

### exactOutput

```solidity
function exactOutput(ISwapRouter.ExactOutputParams params) external payable returns (uint256 amountIn)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| params | ISwapRouter.ExactOutputParams | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| amountIn | uint256 | undefined |

### exactOutputSingle

```solidity
function exactOutputSingle(ISwapRouter.ExactOutputSingleParams params) external payable returns (uint256 amountIn)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| params | ISwapRouter.ExactOutputSingleParams | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| amountIn | uint256 | undefined |




