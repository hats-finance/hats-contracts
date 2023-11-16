// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.16;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "./HATPaymentSplitter.sol";

contract HATPaymentSplitterFactory {
    address public immutable implementation;
    event HATPaymentSplitterCreated(address indexed _hatPaymentSplitter);

    error ArrayLengthMismatch();
    error NoPayees();
    error ZeroAddress();
    error ZeroShares();
    error DulpicatedPayee();

    constructor (address _implementation) {
        implementation = _implementation;
    }

    function createHATPaymentSplitter(address[] memory _payees, uint256[] memory _shares) external returns (address result) {
        result = Clones.cloneDeterministic(implementation, keccak256(abi.encodePacked(_payees, _shares)));
        HATPaymentSplitter(payable(result)).initialize(_payees, _shares);
        emit HATPaymentSplitterCreated(result);
    }

    function predictSplitterAddress(address[] memory _payees, uint256[] memory _shares) public view returns (address) {
        if (_payees.length != _shares.length) revert ArrayLengthMismatch();
        if (_payees.length == 0) revert NoPayees();

        for (uint256 i = 0; i < _payees.length; i++) {
            if (_payees[i] == address(0)) revert ZeroAddress();
            if (_shares[i] == 0) revert ZeroShares();
            for (uint256 j = i + 1; j < _payees.length; j++) {
                if (_payees[i] == _payees[j]) revert DulpicatedPayee();
            }
        }

        return Clones.predictDeterministicAddress(implementation, keccak256(abi.encodePacked(_payees, _shares)));
    }
}
