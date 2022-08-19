// SPDX-License-Identifier: MIT
pragma solidity 0.8.14;

import "./Base.sol";

contract Deposits is Base {
    using SafeERC20 for IERC20;

    /**
    * @dev Deposit funds to the vault. Can only be called if the committee had
    * checked in and deposits are not paused.
    * NOTE: Vaults should not use tokens which do not guarantee that the 
    * amount specified is the amount transferred
    * @param caller Caller of the action (msg.sender)
    * @param receiver Reciever of the shares from the deposit
    * @param assets Amount of vault's token to deposit
    * @param shares Respective amount of shares to be received
    */
    function _deposit(
        address caller,
        address receiver,
        uint256 assets,
        uint256 shares
    ) internal override virtual nonReentrant {
        if (!committeeCheckedIn)
            revert CommitteeNotCheckedInYet();
        if (shares == 0) revert AmountToDepositIsZero();
        // Users can only deposit for themselves if withdraw request exists
        if (withdrawEnableStartTime[receiver] != 0 && receiver != caller) {
            revert CannotDepositToAnotherUserWithWithdrawRequest();
        }

        // clear withdraw request
        withdrawEnableStartTime[receiver] = 0;

        rewardController.updateVaultBalance(receiver, shares, true, true);

        super._deposit(caller, receiver, assets, shares);
    }
}
