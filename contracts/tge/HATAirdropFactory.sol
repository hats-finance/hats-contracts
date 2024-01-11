// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.16;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./HATAirdrop.sol";

contract HATAirdropFactory is Ownable {
    error RedeemDataArraysLengthMismatch();
    error ContractIsNotHATAirdrop();
    error HATAirdropInitializationFailed();

    using SafeERC20Upgradeable for IERC20Upgradeable;

    mapping(address => bool) public isAirdrop;

    event TokensWithdrawn(address indexed _owner, uint256 _amount);
    event HATAirdropCreated(address indexed _hatAirdrop, bytes _initData, IERC20Upgradeable _token, uint256 _totalAmount);

    function withdrawTokens(IERC20Upgradeable _token, uint256 _amount) external onlyOwner {
        address owner = msg.sender;
        _token.safeTransfer(owner, _amount);
        emit TokensWithdrawn(owner, _amount);
    }

    function redeemMultipleAirdrops(HATAirdrop[] calldata _airdrops, uint256[] calldata _amounts, bytes32[][] calldata _proofs) external {
        if (_airdrops.length != _amounts.length || _airdrops.length != _proofs.length) {
            revert RedeemDataArraysLengthMismatch();
        }

        address caller = msg.sender;
        for (uint256 i = 0; i < _airdrops.length;) {
            if (!isAirdrop[address(_airdrops[i])]) {
                revert ContractIsNotHATAirdrop();
            }

            HATAirdrop(_airdrops[i]).redeem(caller, _amounts[i], _proofs[i]);

            unchecked {
                ++i;
            }
        }
    }

    function createHATAirdrop(
        address _implementation,
        bytes calldata _initData,
        IERC20Upgradeable _token,
        uint256 _totalAmount
    ) external onlyOwner returns (address result) {
        result = Clones.cloneDeterministic(_implementation, keccak256(_initData));

        // solhint-disable-next-line avoid-low-level-calls
        (bool success,) = result.call(_initData);

        if (!success) {
            revert HATAirdropInitializationFailed();
        }

        isAirdrop[result] = true;

        _token.safeApprove(result, _totalAmount);

        emit HATAirdropCreated(result, _initData, _token, _totalAmount);
    }

    function predictHATAirdropAddress(
        address _implementation,
        bytes calldata _initData
    ) external view returns (address) {
        return Clones.predictDeterministicAddress(_implementation, keccak256(_initData));
    }
}
