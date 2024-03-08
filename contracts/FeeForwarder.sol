pragma solidity 0.8.16;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract FeeForwarder {
    using SafeERC20 for IERC20;

    address public immutable feeReceiver;

    constructor (address _feeReceiver) {
        feeReceiver = _feeReceiver;
    }

    function forwardFee(IERC20 _asset, uint256 _amount) external {
        _asset.safeTransferFrom(msg.sender, feeReceiver, _amount);
    }
}
