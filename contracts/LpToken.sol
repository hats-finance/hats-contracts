// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import "openzeppelin-solidity/contracts/access/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";


contract LpToken is ERC20, Ownable {
    constructor(
        string memory _name,
        string memory _symbol,
        address _owner
    )
    public
    ERC20(_name, _symbol) {
        transferOwnership(_owner);
    }

    function mint(address _account, uint256 _amount) public onlyOwner {
        return _mint(_account, _amount);
    }

    function burn(address _account, uint256 _amount) public onlyOwner {
        return _burn(_account, _amount);
    }
}
