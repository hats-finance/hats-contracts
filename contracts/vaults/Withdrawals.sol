// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "./Base.sol";

contract Withdrawals is Base {
    using SafeERC20 for IERC20;

    /**
    * @notice Submit a request to withdraw funds from the vault.
    * The request will only be approved if there is no previous active
    * withdraw request.
    * The request will be pending for a period of
    * `HATVaultsRegistry.GeneralParameters.withdrawRequestPendingPeriod`,
    * after which a withdraw will be possible for a duration of
    * `HATVaultsRegistry.GeneralParameters.withdrawRequestEnablePeriod`
    */
    function withdrawRequest() external nonReentrant {
        HATVaultsRegistry.GeneralParameters memory generalParameters = registry.getGeneralParameters();
        // require withdraw to be at least withdrawRequestEnablePeriod+withdrawRequestPendingPeriod
        // since last withdrawRequest (meaning the last withdraw request had expired)
        // unless there's been a deposit or withdraw since, in which case withdrawRequest is allowed immediately
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp <
            withdrawEnableStartTime[msg.sender] +
                generalParameters.withdrawRequestEnablePeriod)
            revert PendingWithdrawRequestExists();
        // set the withdrawEnableStartTime time to be withdrawRequestPendingPeriod from now
        // solhint-disable-next-line not-rely-on-time
        withdrawEnableStartTime[msg.sender] = block.timestamp + generalParameters.withdrawRequestPendingPeriod;
        emit WithdrawRequest(msg.sender, withdrawEnableStartTime[msg.sender]);
    }

    function _withdraw(
        address caller,
        address receiver,
        address owner,
        uint256 assets,
        uint256 shares,
        uint256 fee
    ) internal nonReentrant {
        if (assets == 0) revert WithdrawMustBeGreaterThanZero();
        if (caller != owner) {
            _spendAllowance(owner, caller, shares);
        }

        _burn(owner, shares);

        safeWithdrawVaultToken(assets, fee, receiver);

        emit Withdraw(caller, receiver, owner, assets, shares);
    }

    /** 
    * @notice Withdraw previously deposited funds from the vault, without
    * transferring the accumulated HAT reward.
    * Can only be performed if a withdraw request has been previously
    * submitted, and the pending period had passed, and while the withdraw
    * enabled timeout had not passed. Withdrawals are not permitted during
    * safety periods or while there is an active claim for a bounty payout.
    * @param assets Amount of tokens to withdraw
    * @param receiver Address of receiver of the funds 
    * @param owner Address of owner of the funds 
    * @dev See {IERC4626-withdraw}.
    */
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public override virtual returns (uint256) {
        if (assets > maxWithdraw(owner)) revert WithdrawMoreThanMax();

        uint256 shares = previewWithdraw(assets);
        uint256 fee = _convertToAssets(shares - _convertToShares(assets, MathUpgradeable.Rounding.Up), MathUpgradeable.Rounding.Up);
        _withdraw(_msgSender(), receiver, owner, assets, shares, fee);

        return shares;
    }

    /** 
    * @notice Withdraw previously deposited funds from the vault and claim
    * the HAT reward that the user has earned.
    * Can only be performed if a withdraw request has been previously
    * submitted, and the pending period had passed, and while the withdraw
    * enabled timeout had not passed. Withdrawals are not permitted during
    * safety periods or while there is an active claim for a bounty payout.
    * @param assets Amount of tokens to withdraw
    * @param receiver Address of receiver of the funds
    * @param owner Address of owner of the funds
    * @dev See {IERC4626-withdraw}.
    */
    function withdrawAndClaim(
        uint256 assets,
        address receiver,
        address owner
    ) external returns (uint256 shares) {
        shares = withdraw(assets, receiver, owner);
        rewardController.claimReward(address(this), owner);
    }

    /** 
    * @notice Redeem shares in the vault, and withdraw the respective amount
    * of underlying assets.
    * Can only be performed if a withdraw request has been previously
    * submitted, and the pending period had passed, and while the withdraw
    * enabled timeout had not passed. Withdrawals are not permitted during
    * safety periods or while there is an active claim for a bounty payout.
    * @param shares Amount of shares to redeem
    * @param receiver Address of receiver of the funds 
    * @param owner Address of owner of the funds 
    * @dev See {IERC4626-redeem}.
    */
    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) public override virtual returns (uint256) {
        if (shares > maxRedeem(owner)) revert RedeemMoreThanMax();

        uint256 assets = previewRedeem(shares);
        uint256 fee = _convertToAssets(shares, MathUpgradeable.Rounding.Down) - assets;
        _withdraw(_msgSender(), receiver, owner, assets, shares, fee);

        return assets;
    }

    function redeemAndClaim(
        uint256 shares,
        address receiver,
        address owner
    ) external returns (uint256 assets) {
        assets = redeem(shares, receiver, owner);
        rewardController.claimReward(address(this), owner);
    }

    /**
    * @dev Checks that the sender can perform a withdraw at this time
    * and also sets the withdrawEnableStartTime to 0
    * @param _user Address of the user to check
    */
    function checkWithdrawAndResetWithdrawEnableStartTime(address _user)
        internal
        noActiveClaim
    {
        if (!isWithdrawEnabledForUser(_user))
            revert InvalidWithdrawRequest();
        // if all is ok and withdrawal can be made - reset withdrawRequests[_pid][msg.sender] so that another withdrawRequest
        // will have to be made before next withdrawal
        withdrawEnableStartTime[_user] = 0;
    }

    /**
    * @dev Checks that the given user can perform a withdraw at this time
    * @param _user Address of the user to check
    */
    function isWithdrawEnabledForUser(address _user)
        internal view
        returns(bool)
    {
        HATVaultsRegistry.GeneralParameters memory generalParameters = registry.getGeneralParameters();
        // disable withdraw for safetyPeriod (e.g 1 hour) after each withdrawPeriod (e.g 11 hours)
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp %
        (generalParameters.withdrawPeriod + generalParameters.safetyPeriod) >=
            generalParameters.withdrawPeriod) return false;
        // check that withdrawRequestPendingPeriod had passed
        // solhint-disable-next-line not-rely-on-time
        return (block.timestamp >= withdrawEnableStartTime[_user] &&
        // check that withdrawRequestEnablePeriod had not passed and that the
        // last action was withdrawRequest (and not deposit or withdraw, which
        // reset withdrawRequests[_user] to 0)
        // solhint-disable-next-line not-rely-on-time
            block.timestamp <=
                withdrawEnableStartTime[_user] +
                generalParameters.withdrawRequestEnablePeriod);
    }

    /**
    * @dev Safely transfer vault's native token to reciever, and fee to 
    * governance
    * @param _totalAmount Amount of vault's native token to transfer to the 
    * receiver
    * @param _fee Amount of vault's native token to transfer to vault's owner
    * @param _receiver Address of receiver of funds
    */
    function safeWithdrawVaultToken(uint256 _totalAmount, uint256 _fee, address _receiver)
        internal
    {
        IERC20 asset = IERC20(asset());
        if (_fee > 0) {
            asset.safeTransfer(registry.owner(), _fee);
        }
        asset.safeTransfer(_receiver, _totalAmount);
    }
}