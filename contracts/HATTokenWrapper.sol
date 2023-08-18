// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.16;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";

contract HATTokenWrapper is ERC4626 {

    error AmountOfSharesMustBeMoreThanMinimalAmount();

    uint256 public constant MINIMAL_AMOUNT_OF_SHARES = 1e3; // to reduce rounding errors, the number of shares is either 0, or > than this number

    constructor (IERC20 _asset, string memory _name, string memory _symbol) ERC4626(_asset) ERC20(_name, _symbol) {}

    function _afterTokenTransfer(address, address, uint256) internal virtual override {
        if (totalSupply() > 0 && totalSupply() < MINIMAL_AMOUNT_OF_SHARES) {
          revert AmountOfSharesMustBeMoreThanMinimalAmount();
        }
    }

}
