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
        if (poolDepositPause[_pid]) revert DepositPaused();
        
        //clear withdraw request
        withdrawEnableStartTime[_pid][msg.sender] = 0;
        PoolInfo storage pool = poolInfos[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        _claimReward(_pid, user);
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

        if (userShares == 0) revert AmountLessThanMinDeposit();
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
        UserInfo memory user = userInfo[_pid][msg.sender];

        _claimReward(_pid, user);

        emit ClaimReward(_pid);
    }

    /**
     * @notice rewardDepositors - add pool tokens to reward depositors in the pool's native token
     * The funds will be given to depositors pro rata upon withdraw
     * The sender of the transaction must have approved the spend before calling this function
     * @param _pid pool id
     * @param _amount amount of pool's native token to add
    */
    function rewardDepositors(uint256 _pid, uint256 _amount) external nonReentrant {        
        IERC20Upgradeable lpToken = poolInfos[_pid].lpToken;
        uint256 balanceBefore = lpToken.balanceOf(address(this));
        lpToken.safeTransferFrom(msg.sender, address(this), _amount);
        uint256 lpTokenReceived = lpToken.balanceOf(address(this)) - balanceBefore;

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

    function _claimReward(uint256 _pid, UserInfo memory _user) internal {
        if (!poolInfos[_pid].committeeCheckedIn)
            revert CommitteeNotCheckedInYet();
        updatePool(_pid);
        // if the user already has funds in the pool, give the previous reward
        if (_user.shares > 0) {
            uint256 pending = _user.shares * poolInfos[_pid].rewardPerShare / 1e12 - _user.rewardDebt;
            if (pending > 0) {
                safeTransferReward(msg.sender, pending, _pid);
            }
        }
    }
}
