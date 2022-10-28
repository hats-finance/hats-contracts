// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;


contract EvilMock {

    function rewardControllerRemoved(address) public returns (bool) {
        return false;
    }

    function totalSupply() public returns (uint256) {
      return 100;
    }

    function balanceOf(address) public returns (uint256) {
      return 100;
    }
}
