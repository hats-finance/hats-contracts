// SPDX-License-Identifier: MIT
pragma solidity 0.8.14;

import "./Base.sol";

contract Deposit is Base {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /**
    * @notice Deposit tokens to pool
    * Caller must have set an allowance first
    * @param _pid The pool id
    * @param _amount Amount of pool's token to deposit. Must be at least `MINIMUM_DEPOSIT`
    **/
    function deposit(uint256 _pid, uint256 _amount) external nonReentrant {
        if (!poolInfos[_pid].committeeCheckedIn)
            revert CommitteeNotCheckedInYet();
        if (poolDepositPause[_pid]) revert DepositPaused();
        if (_amount < MINIMUM_DEPOSIT) revert AmountLessThanMinDeposit();
        
        //clear withdraw request
        withdrawEnableStartTime[_pid][msg.sender] = 0;
        PoolInfo storage pool = poolInfos[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        updatePool(_pid);
        if (user.shares > 0) {
            uint256 pending = user.shares * pool.rewardPerShare / 1e12 - user.rewardDebt;
            if (pending > 0) {
                safeTransferReward(msg.sender, pending, _pid);
            }
        }
        uint256 lpSupply = pool.balance;
        uint256 balanceBefore = pool.lpToken.balanceOf(address(this));

        pool.lpToken.safeTransferFrom(msg.sender, address(this), _amount);

        uint256 transferredAmount = pool.lpToken.balanceOf(address(this)) - balanceBefore;
        pool.balance += transferredAmount;

        // create new shares (and add to the user and the pool's shares) that are the relative part of the user's new deposit
        // out of the pool's total supply, relative to the previous total shares in the pool
        uint256 userShares;
        if (pool.totalShares == 0) {
            userShares = transferredAmount;
        } else {
            userShares = pool.totalShares * transferredAmount / lpSupply;
        }

        user.shares += userShares;
        pool.totalShares += userShares;
        user.rewardDebt = user.shares * pool.rewardPerShare / 1e12;

        emit Deposit(msg.sender, _pid, _amount, transferredAmount);
    }

     /**
     * @notice Transfer to the sender their pending share of rewards.
     * @param _pid The pool id
     */
    function claimReward(uint256 _pid) external {
        updatePool(_pid);

        UserInfo storage user = userInfo[_pid][msg.sender];
        uint256 rewardPerShare = poolInfos[_pid].rewardPerShare;
        if (user.shares > 0) {
            uint256 pending = user.shares * rewardPerShare / 1e12 - user.rewardDebt;
            if (pending > 0) {
                user.rewardDebt = user.shares * rewardPerShare / 1e12;
                safeTransferReward(msg.sender, pending, _pid);
            }
        }

        emit ClaimReward(_pid);
    }

    /**
     * @notice rewardDepositors - add pool tokens to reward depositors in the pool's native token0
     * The funds will be given to depositors pro rata upon withdraw
     * The sender of the transaction must have approved the spend before calling this function
     * @param _pid pool id
     * @param _amount amount of pool's native token to add
    */
    function rewardDepositors(uint256 _pid, uint256 _amount) external nonReentrant {
        if ((poolInfos[_pid].balance + _amount) / MINIMUM_DEPOSIT >=
            poolInfos[_pid].totalShares) revert AmountToRewardTooBig();

        uint256 balanceBefore = poolInfos[_pid].lpToken.balanceOf(address(this));
        poolInfos[_pid].lpToken.safeTransferFrom(msg.sender, address(this), _amount);
        uint256 lpTokenReceived = poolInfos[_pid].lpToken.balanceOf(address(this)) - balanceBefore;

        poolInfos[_pid].balance += lpTokenReceived;

        emit RewardDepositors(_pid, _amount, lpTokenReceived);
    }
    /**
     * @notice add reward tokens to the hatVaults contrac, to be distributed as rewards
     * The sender of the transaction must have approved the spend before calling this function
     * @param _amount amount of rewardToken to add
    */
    function depositReward(uint256 _amount) external nonReentrant {
        uint256 balanceBefore = rewardToken.balanceOf(address(this));
        rewardToken.safeTransferFrom(msg.sender, address(this), _amount);
        uint256 rewardTokenReceived = rewardToken.balanceOf(address(this)) - balanceBefore;
        rewardAvailable += rewardTokenReceived;

        emit DepositReward(_amount, rewardTokenReceived, address(rewardToken));
    }
}
