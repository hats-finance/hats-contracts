// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";


// DAOToken class using ERC20
contract DAOToken is ERC20 {

    constructor (
        string memory name,
        string memory symbol
    )
     // solhint-disable-next-line func-visibility,no-empty-blocks
    payable ERC20(name, symbol) {}

    function mint(address account, uint256 amount) public {
        _mint(account, amount);
    }

}
