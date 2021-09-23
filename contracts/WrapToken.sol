// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";


 // Wrap an ERC20 token with other ERC20 token.
contract WrapToken is ERC20 {

    IERC20 public immutable token;
    uint8 public immutable tokenDecimals;

    constructor(address _token,
                string memory _name,
                string memory _symbol)
    ERC20(_name, _symbol) {
        token = IERC20(_token);
        tokenDecimals = ERC20(_token).decimals();
    }

     // Locks token and mints wrapToken for the msg.sender
    function wrapToken(uint256 _amount) external {
        token.transferFrom(msg.sender, address(this), _amount);
        _mint(msg.sender, _amount);
    }

     // Unlocks token and burn wrapToken
    function unwrapToken(uint256 _amount) external {
        _burn(msg.sender, _amount);
        token.transfer(msg.sender, _amount);
    }

    function decimals() public view override returns (uint8) {
        return tokenDecimals;
    }
}
