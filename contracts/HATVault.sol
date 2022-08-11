// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.14;


import "./vaults/Claim.sol";
import "./vaults/Deposits.sol";
import "./vaults/Params.sol";
import "./vaults/Withdrawals.sol";

contract HATVault is Claim, Deposits, Params, Withdrawals {

    function _deposit(
        address caller,
        address receiver,
        uint256 assets,
        uint256 shares
    ) internal override(Deposits, ERC4626Upgradeable) {
        Deposits._deposit(caller, receiver, assets, shares);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        if (from == address(0) || to == address(0)) {
            return;
        }
        // Users can only deposit for themselves if withdraw request exists
        if (withdrawEnableStartTime[to] != 0) {
            revert CannotDepositToAnotherUserWithWithdrawRequest();
        }

        checkWithdrawAndResetWithdrawEnableStartTime(from);

        rewardController.updateVaultBalance(to, amount, true, true);
        rewardController.updateVaultBalance(from, amount, false, true);
    }

    /** @dev See {IERC4626-withdraw}. */
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public override(Withdrawals, ERC4626Upgradeable) returns (uint256) {
        return Withdrawals.withdraw(assets, receiver, owner);
    }

    /** @dev See {IERC4626-redeem}. */
    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) public override(Withdrawals, ERC4626Upgradeable) returns (uint256) {
        return Withdrawals.redeem(shares, receiver, owner);
    }

    /** @dev See {IERC4626-maxDeposit}. */
    function maxDeposit(address) public view virtual override returns (uint256) {
        return depositPause ? 0 : type(uint256).max;
    }

    /** @dev See {IERC4626-maxMint}. */
    function maxMint(address) public view virtual override returns (uint256) {
        return depositPause ? 0 : type(uint256).max;
    }

    /** @dev See {IERC4626-maxWithdraw}. */
    function maxWithdraw(address owner) public view virtual override returns (uint256) {
        if (activeClaim.createdAt != 0 || !isWithdrawEnabledForUser(owner)) return 0;
        return previewRedeem(balanceOf(owner));
    }

    /** @dev See {IERC4626-maxRedeem}. */
    function maxRedeem(address owner) public view virtual override returns (uint256) {
        if (activeClaim.createdAt != 0 || !isWithdrawEnabledForUser(owner)) return 0;
        return balanceOf(owner);
    }

    /** @dev See {IERC4626-previewWithdraw}. */
    function previewWithdraw(uint256 assets) public view virtual override returns (uint256) {
        uint256 assetsPlusFee = (assets * HUNDRED_PERCENT / (HUNDRED_PERCENT - withdrawalFee));
       return _convertToShares(assetsPlusFee, MathUpgradeable.Rounding.Up);
    }
    /** @dev See {IERC4626-previewRedeem}. */
    function previewRedeem(uint256 shares) public view virtual override returns (uint256) {
        uint256 assets = _convertToAssets(shares, MathUpgradeable.Rounding.Down);
        uint256 fee = assets * withdrawalFee / HUNDRED_PERCENT;
        return assets - fee;
    }
}
