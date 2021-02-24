// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Snapshot.sol";
import "openzeppelin-solidity/contracts/access/Ownable.sol";


contract HATToken is ERC20Snapshot, Ownable {
    constructor(
        string memory _name,
        string memory _symbol,
        address _owner
    )
    public
    ERC20(_name, _symbol) {
        transferOwnership(_owner);
    }
    
    //todo restrict snapshot role..
    function snapshot() public returns(uint256) {
        return _snapshot();
    }

    function mint(address _account, uint256 _amount) public onlyOwner {
        return _mint(_account, _amount);
    }

    function burn(address _account, uint256 _amount) public onlyOwner {
        return _burn(_account, _amount);
    }
}
