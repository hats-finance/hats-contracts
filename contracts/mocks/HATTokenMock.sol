// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "../HATToken.sol";
//solhint-disable func-visibility 
//solhint-disable no-empty-blocks

contract HATTokenMock is HATToken {
    constructor(address _governance, uint256 _timeLockDelayInBlocksUnits)
    HATToken(_governance, _timeLockDelayInBlocksUnits) {
    }

    function burnFrom(address _from, uint256 _amount) public {
        return _burn(_from, _amount);
    }

    function delegateTwice(address _delegatee, address _delegatee2) public {
        _delegate(msg.sender, _delegatee);
        _delegate(msg.sender, _delegatee2);
        _delegate(msg.sender, _delegatee);
    }

    function transferFromZero(address _dst, uint256 _amount) public {
        _transfer(0x0000000000000000000000000000000000000000, _dst, _amount);
    }

}
