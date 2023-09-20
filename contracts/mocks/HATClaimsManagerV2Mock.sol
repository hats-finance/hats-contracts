// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "../HATClaimsManager.sol";


contract HATClaimsManagerV2Mock is HATClaimsManager {
    function getVersion() external pure returns(string memory) {
        return "New version!";
    }
}
