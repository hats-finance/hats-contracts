// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";


contract UniSwapV2RouterMock {

    function swapExactTokensForTokens(
        uint amountIn,
        uint,
        address[] calldata path,
        address to,
        uint
    ) external returns (uint[] memory amounts) {
        uint256 amountToSendBack =  ERC20(path[1]).balanceOf(address(this));
        ERC20(path[0]).transferFrom(msg.sender, address(this), amountIn);
        //swap 1 to 1...
        IERC20(path[1]).transfer(to, amountToSendBack);
        amounts = new uint[](2);
        amounts[0] = amountIn;
        amounts[1] = amountToSendBack;
    }
}
