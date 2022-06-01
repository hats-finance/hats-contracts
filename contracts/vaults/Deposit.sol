// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "./Base.sol";

contract Deposit is Base {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    function depositReward(uint256 _amount) external {
        uint256 balanceBefore = rewardToken.balanceOf(address(this));
        rewardToken.transferFrom(address(msg.sender), address(this), _amount);
        uint256 rewardTokenReceived = rewardToken.balanceOf(address(this)) - balanceBefore;
        rewardAvailable += rewardTokenReceived;
        emit DepositReward(_amount, rewardTokenReceived, address(rewardToken));
    }

    /**
     * @dev rewardDepositors - add funds to pool to reward depositors.
     * The funds will be given to depositors pro rata upon withdraw
     * @param _pid pool id
     * @param _amount amount to add
    */
    function rewardDepositors(uint256 _pid, uint256 _amount) external {
        require((poolInfos[_pid].balance + _amount) / MINIMUM_DEPOSIT < poolInfos[_pid].totalShares,
        "HVE11");
        uint256 balanceBefore = poolInfos[_pid].lpToken.balanceOf(address(this));
        poolInfos[_pid].lpToken.safeTransferFrom(msg.sender, address(this), _amount);
        uint256 lpTokenReceived = poolInfos[_pid].lpToken.balanceOf(address(this)) - balanceBefore;
        poolInfos[_pid].balance += lpTokenReceived;
        emit RewardDepositors(_pid, _amount, lpTokenReceived);
    }

    /**
     * @notice Transfer the sender their pending share of rewards.
     * @param _pid The pool id
     */
    function claimReward(uint256 _pid) external {
        UserInfo memory user = userInfo[_pid][msg.sender];
        _claimReward(_pid, user);
        emit ClaimReward(_pid);
    }

    /**
    * @notice Deposit tokens to pool
    * @param _pid The pool id
    * @param _amount Amount of pool's token to deposit. Must be at least `MINIMUM_DEPOSIT`
    **/
    function deposit(uint256 _pid, uint256 _amount) external nonReentrant {
        require(!poolDepositPause[_pid], "HVE26");
        require(_amount >= MINIMUM_DEPOSIT, "HVE27");
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
        uint256 userShares = transferredAmount;
        // create new shares (and add to the user and the pool's shares) that are the relative part of the user's new deposit
        // out of the pool's total supply, relative to the previous total shares in the pool
        if (pool.totalShares > 0) {
            userShares = pool.totalShares * transferredAmount / lpSupply;
        }
        user.shares += userShares;
        pool.totalShares += userShares;
        user.rewardDebt = user.shares * pool.rewardPerShare / 1e12;
        emit Deposit(msg.sender, _pid, _amount, transferredAmount);
    }

    function _claimReward(uint256 _pid, UserInfo memory _user) internal {
        require(bountyInfos[_pid].committeeCheckIn, "HVE40");
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
