// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;


import "../HATMaster.sol";


contract PoolUpdateHelper {
    function updatePoolsTwice(HATMaster target, uint256 _fromPid, uint256 _toPid) external {
        target.massUpdatePools(_fromPid, _toPid);
        target.massUpdatePools(_fromPid, _toPid);
    }
}
