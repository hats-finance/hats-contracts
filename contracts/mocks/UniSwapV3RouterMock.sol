// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "../interfaces/ISwapRouter.sol";


contract UniSwapV3RouterMock {

    enum ReturnType {ONE_TO_ONE, MINIMUM, BELOW_MINIMUM}

    ReturnType public returnType;

    constructor(
        ReturnType _returnType
    ) {
        returnType = _returnType;
    }

    function exactInputSingle(
        ISwapRouter.ExactInputSingleParams memory _params
    ) external returns (uint256 amount) {
        uint256 amountToSendBack;

        if (returnType == ReturnType.ONE_TO_ONE) {
            amountToSendBack = _params.amountIn;
        }

        if (returnType == ReturnType.MINIMUM) {
            amountToSendBack = _params.amountOutMinimum;
        }

        if (returnType == ReturnType.BELOW_MINIMUM) {
            amountToSendBack = _params.amountOutMinimum - 1;
        }
        ERC20(_params.tokenIn).transferFrom(msg.sender, address(this), _params.amountIn);
        //swap 1 to 1...
        IERC20(_params.tokenOut).transfer(_params.recipient, amountToSendBack);
        return amountToSendBack;
    }
}
