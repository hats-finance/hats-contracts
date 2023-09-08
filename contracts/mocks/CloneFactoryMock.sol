// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "@openzeppelin/contracts/proxy/Clones.sol";

contract CloneFactoryMock {
    event CloneCreated(address indexed _clone);

    function clone(address target) external returns (address result) {
        result = Clones.clone(target);
        emit CloneCreated(result);
    }
}
