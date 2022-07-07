// SPDX-License-Identifier: MIT
pragma solidity 0.8.14;

import "./Base.sol";

contract Getters is Base {
    function getNumberOfPools() external view returns (uint256) {
        return poolInfos.length;
    }
}
