// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.16;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "./HATAirdrop.sol";

contract HATAirdropFactory {
    address public immutable implementation;
    event HATAirdropCreated(address indexed _hatAirdrop);

    constructor (address _implementation) {
        implementation = _implementation;
    }

    function createHATAirdrop(
        address _owner,
        string memory _merkleTreeIPFSRef,
        bytes32 _root,
        uint256 _startTime,
        uint256 _deadline,
        uint256 _lockEndTime,
        uint256 _periods,
        IERC20Upgradeable _token,
        ITokenLockFactory _tokenLockFactory
    ) external returns (address result) {
        result = Clones.cloneDeterministic(implementation, keccak256(abi.encodePacked(
            _owner,
            _merkleTreeIPFSRef,
            _root,
            _startTime,
            _deadline,
            _lockEndTime,
            _periods,
            _token,
            _tokenLockFactory
        )));

        HATAirdrop(payable(result)).initialize(
            _owner,
            _merkleTreeIPFSRef,
            _root,
            _startTime,
            _deadline,
            _lockEndTime,
            _periods,
            _token,
            _tokenLockFactory
        );

        emit HATAirdropCreated(result);
    }

    function predictHATAirdropAddress(
        address _owner,
        string memory _merkleTreeIPFSRef,
        bytes32 _root,
        uint256 _startTime,
        uint256 _deadline,
        uint256 _lockEndTime,
        uint256 _periods,
        IERC20 _token,
        ITokenLockFactory _tokenLockFactory
    ) public view returns (address) {
        return Clones.predictDeterministicAddress(implementation, keccak256(abi.encodePacked(
            _owner,
            _merkleTreeIPFSRef,
            _root,
            _startTime,
            _deadline,
            _lockEndTime,
            _periods,
            _token,
            _tokenLockFactory
        )));
    }
}
