// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

// This contract handles swapping to and from xHAT
contract XHATToken is ERC20("xHATToken", "xHAT") {

    IERC20 public immutable HAT;

    // Define the xHAT token contract
    constructor(IERC20 _hat) {
        HAT = _hat;
    }

    // Locks HAT and mints xHAT
    function swapHAT2xHAT(uint256 _amount) public {
        // Lock HAT in the contract
        HAT.transferFrom(msg.sender, address(this), _amount);
        _mint(msg.sender, _amount);
    }

    // Unlocks HAT and burn xHAT
    function swapxHAT2HAT(uint256 _amount) public {
        _burn(msg.sender, _amount);
        HAT.transfer(msg.sender, _amount);
    }
}
