// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";


contract ERC20Mock is ERC20 {

    /// @notice A record of each accounts delegate
    mapping (address => address) public delegates;

    constructor(
        string memory _name,
        string memory _symbol,
        address _owner
    )
    ERC20(_name, _symbol) {
    }

    function mint(address _to, uint256 _amount) public {
        _mint(_to, _amount);
    }

    /**
     * @notice Delegate votes from `msg.sender` to `delegatee`
     * @param delegatee The address to delegate votes to
     */
    function delegate(address delegatee) public {
        delegates[msg.sender] = delegatee;
    }
}
