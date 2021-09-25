// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/utils/SafeERC20.sol";


 // Wrap an ERC20 token with other ERC20 token.
contract WrapToken is ERC20 {
    using SafeERC20 for IERC20;

    IERC20 public immutable tokenToWrap;
    uint8 public immutable tokenToWrapDecimals;

    constructor(address _tokenToWrap,
                string memory _name,
                string memory _symbol)
    ERC20(_name, _symbol) {
        tokenToWrap = IERC20(_tokenToWrap);
        tokenToWrapDecimals = ERC20(_tokenToWrap).decimals();
    }

     // Locks tokenToWrap and mints wrapToken for the msg.sender
    function wrapToken(uint256 _amount) external {
        tokenToWrap.safeTransferFrom(msg.sender, address(this), _amount);
        _mint(msg.sender, _amount);
    }

     // Unlocks tokenToWrap and burn wrapToken
    function unwrapToken(uint256 _amount) external {
        _burn(msg.sender, _amount);
        tokenToWrap.safeTransfer(msg.sender, _amount);
    }

    function decimals() public view override returns (uint8) {
        return tokenToWrapDecimals;
    }
}
