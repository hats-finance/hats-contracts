// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.16;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./HATAirdrop.sol";

contract HATAirdropFactory is Ownable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    event TokensWithdrawn(address indexed _owner, uint256 _amount);
    event HATAirdropCreated(
        address indexed _hatAirdrop,
        string _merkleTreeIPFSRef,
        bytes32 _root,
        uint256 _startTime,
        uint256 _deadline,
        uint256 _lockEndTime,
        uint256 _periods,
        uint256 _totalAmount,
        IERC20Upgradeable _token,
        ITokenLockFactory _tokenLockFactory
    );

    function withdrawTokens(IERC20Upgradeable _token, uint256 _amount) external onlyOwner {
        address owner = owner();
        _token.safeTransfer(owner, _amount);
        emit TokensWithdrawn(owner, _amount);
    }

    function createHATAirdrop(
        address _implementation,
        string memory _merkleTreeIPFSRef,
        bytes32 _root,
        uint256 _startTime,
        uint256 _deadline,
        uint256 _lockEndTime,
        uint256 _periods,
        uint256 _totalAmount,
        IERC20Upgradeable _token,
        ITokenLockFactory _tokenLockFactory
    ) external onlyOwner returns (address result) {
        result = Clones.cloneDeterministic(_implementation, keccak256(abi.encodePacked(
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
            _merkleTreeIPFSRef,
            _root,
            _startTime,
            _deadline,
            _lockEndTime,
            _periods,
            _token,
            _tokenLockFactory
        );

        _token.safeApprove(result, _totalAmount);

        emit HATAirdropCreated(
            result,
            _merkleTreeIPFSRef,
            _root,
            _startTime,
            _deadline,
            _lockEndTime,
            _periods,
            _totalAmount,
            _token,
            _tokenLockFactory
        );
    }

    function predictHATAirdropAddress(
        address _implementation,
        string memory _merkleTreeIPFSRef,
        bytes32 _root,
        uint256 _startTime,
        uint256 _deadline,
        uint256 _lockEndTime,
        uint256 _periods,
        IERC20 _token,
        ITokenLockFactory _tokenLockFactory
    ) external view returns (address) {
        return Clones.predictDeterministicAddress(_implementation, keccak256(abi.encodePacked(
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
