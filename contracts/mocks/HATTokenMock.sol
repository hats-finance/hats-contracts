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
        uint96 amount = safe96(_amount, "HAT::transfer: amount exceeds 96 bits");
        _transferTokens(0x0000000000000000000000000000000000000000, _dst, amount);
    }

    function testSafe32(uint256 _num) public pure returns (uint32) {
        return safe32(_num, "HAT::_writeCheckpoint: block number exceeds 32 bits");
    }

}
