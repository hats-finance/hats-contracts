// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;



contract EtherTransferFail {
    receive() external payable {
       revert("cannot accept transfer");
    }
   
}
