// SPDX-License-Identifier: MIT
pragma solidity 0.8.14;

import "./Base.sol";

contract Deposit is Base {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /**
    * @notice Deposit tokens to pool
    * Caller must have set an allowance first
    * @param _pid The pool id
    * @param _amount Amount of pool's token to deposit.
    **/
    function deposit(uint256 _pid, uint256 _amount) external nonReentrant {
        if (!poolInfos[_pid].committeeCheckedIn)
            revert CommitteeNotCheckedInYet();
        if (poolDepositPause[_pid]) revert DepositPaused();
        if (!poolInitialized[_pid]) revert PoolMustBeInitialized();
        
        //clear withdraw request
        withdrawEnableStartTime[_pid][msg.sender] = 0;
        PoolInfo storage pool = poolInfos[_pid];
        uint256 lpSupply = pool.balance;
        uint256 balanceBefore = pool.lpToken.balanceOf(address(this));

        pool.lpToken.safeTransferFrom(msg.sender, address(this), _amount);

        uint256 transferredAmount = pool.lpToken.balanceOf(address(this)) - balanceBefore;

        if (transferredAmount == 0) revert AmountToDepositIsZero();

        pool.balance += transferredAmount;

        // create new shares (and add to the user and the pool's shares) that are the relative part of the user's new deposit
        // out of the pool's total supply, relative to the previous total shares in the pool
        uint256 addedUserShares;
        if (pool.totalShares == 0) {
            addedUserShares = transferredAmount;
        } else {
            addedUserShares = pool.totalShares * transferredAmount / lpSupply;
        }

        pool.rewardController.updateRewardPool(_pid, msg.sender, addedUserShares, true, true);

        userShares[_pid][msg.sender] += addedUserShares;
        pool.totalShares += addedUserShares;

        emit Deposit(msg.sender, _pid, _amount, transferredAmount);
    }
}
