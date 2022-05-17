// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "../libraries/LibAppStorage.sol";

contract ReentrancyCheckMock is Modifiers {
    function noReentrancy() public nonReentrant {
        noReentrancy();
    }
}