// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interfaces/ISwapRouter.sol";


contract UniSwapV3RouterMock {

   /// @notice The length of the bytes encoded address
    uint256 private constant ADDR_SIZE = 20;
   /// @notice The length of the bytes encoded fee
    uint256 private constant FEE_SIZE = 3;
    /// @notice The offset of a single token address and pool fee
    uint256 private constant NEXT_OFFSET = ADDR_SIZE + FEE_SIZE;

    enum ReturnType {ONE_TO_ONE, MINIMUM, BELOW_MINIMUM}

    ReturnType public returnType;
    address public immutable WETH9;

    constructor(
        ReturnType _returnType,
        address _weth9
    // solhint-disable-next-line func-visibility
    ) {
        returnType = _returnType;
        WETH9 = _weth9;
    }

    function exactInput(
        ISwapRouter.ExactInputParams memory _params
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
        address tokennIn = toAddress(_params.path, 0);
        ERC20(tokennIn).transferFrom(msg.sender, address(this), _params.amountIn);
        //swap 1 to 1...
        address tokenOut = toAddress(_params.path, NEXT_OFFSET*numPools(_params.path));
        IERC20(tokenOut).transfer(_params.recipient, amountToSendBack);
        return amountToSendBack;
    }

    function toAddress(bytes memory _bytes, uint256 _start) internal pure returns (address) {
        require(_start + 20 >= _start, "toAddress_overflow");
        require(_bytes.length >= _start + 20, "toAddress_outOfBounds");
        address tempAddress;

        // solhint-disable-next-line no-inline-assembly
        assembly {
            tempAddress := div(mload(add(add(_bytes, 0x20), _start)), 0x1000000000000000000000000)
        }

        return tempAddress;
    }

    /// @notice Returns the number of pools in the path
   /// @param path The encoded swap path
   /// @return The number of pools in the path
    function numPools(bytes memory path) internal pure returns (uint256) {
           // Ignore the first token address. From then on every fee and token offset indicates a pool.
        return ((path.length - ADDR_SIZE) / NEXT_OFFSET);
    }

}
