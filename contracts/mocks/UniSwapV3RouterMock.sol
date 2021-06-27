// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "../interfaces/ISwapRouter.sol";


contract UniSwapV3RouterMock {

    function exactInputSingle(
        ISwapRouter.ExactInputSingleParams memory _params
    ) external returns (uint256 amount) {
        uint256 amountToSendBack =  _params.amountIn;
        ERC20(_params.tokenIn).transferFrom(msg.sender, address(this), _params.amountIn);
        //swap 1 to 1...
        IERC20(_params.tokenOut).transfer(_params.recipient, amountToSendBack);
        return amountToSendBack;
    }
}
