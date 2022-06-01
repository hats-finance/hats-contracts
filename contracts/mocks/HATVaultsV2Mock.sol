// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.6;


import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "../vaults/Claim.sol";
import "../vaults/Deposit.sol";
import "../vaults/Params.sol";
import "../vaults/Pool.sol";
import "../vaults/Swap.sol";
import "../vaults/Getters.sol";
import "../vaults/Withdraw.sol";

/// @title Manage all Hats.finance vaults
contract HATVaultsV2Mock is Claim, Deposit, Params, Pool, Swap, Getters, Withdraw {
    function getHatsVersion() external pure returns(uint8) {
        return 2;
    }
}