// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "../HATToken.sol";


contract HATTokenMock is HATToken {
    constructor(address _governance, uint256 _timeLockDelayInBlocksUnits) HATToken(_governance, _timeLockDelayInBlocksUnits) {
    }

    function burnFrom(address _from, uint256 _amount) public {
        return _burn(_from, _amount);
    }

}
