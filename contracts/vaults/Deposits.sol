// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "./Base.sol";

contract Deposits is Base {
    using SafeERC20 for IERC20;

    // @note: Vaults should not use tokens which does not guarantee
    // that the amount specified is the amount transferred
    function _deposit(
        address caller,
        address receiver,
        uint256 assets,
        uint256 shares
    ) internal override virtual nonReentrant {
        if (shares == 0) revert AmountToDepositIsZero();
        // Users can only deposit for themselves if withdraw request exists
        if (withdrawEnableStartTime[receiver] != 0 && receiver != caller) {
            revert CannotDepositToAnotherUserWithWithdrawRequest();
        }

        // clear withdraw request
        withdrawEnableStartTime[receiver] = 0;

        rewardController.updateVaultBalance(receiver, shares, true);

        super._deposit(caller, receiver, assets, shares);
    }
}
