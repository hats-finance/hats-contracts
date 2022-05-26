// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "./Base.sol";

contract Deposit is Base {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    function depositHATReward(uint256 _amount) external {
        hatRewardAvailable += _amount;
        HAT.transferFrom(address(msg.sender), address(this), _amount);
        emit DepositHATReward(_amount);
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
        poolInfos[_pid].lpToken.safeTransferFrom(msg.sender, address(this), _amount);
        poolInfos[_pid].balance += _amount;
        emit RewardDepositors(_pid, _amount);
    }

    /**
     * @notice Transfer the sender their pending share of HATs rewards.
     * @param _pid The pool id
     */
    function claimReward(uint256 _pid) external {
        _deposit(_pid, 0);
        emit ClaimReward(_pid);
    }

    /**
    * @notice Deposit tokens to pool
    * @param _pid The pool id
    * @param _amount Amount of pool's token to deposit. Must be at least `MINIMUM_DEPOSIT`
    **/
    function deposit(uint256 _pid, uint256 _amount) external {
        require(!poolDepositPause[_pid], "HVE26");
        require(_amount >= MINIMUM_DEPOSIT, "HVE27");
        //clear withdraw request
        withdrawEnableStartTime[_pid][msg.sender] = 0;
        uint256 transferredAmount = _deposit(_pid, _amount);
        emit Deposit(msg.sender, _pid, _amount, transferredAmount);
    }

    function _deposit(uint256 _pid, uint256 _amount) internal nonReentrant returns(uint256 _transferredAmount) {
        require(bountyInfos[_pid].committeeCheckIn, "HVE40");
        PoolInfo storage pool = poolInfos[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        updatePool(_pid);
        // if the user already has funds in the pool, give the previous reward
        if (user.shares > 0) {
            uint256 pending = user.shares * pool.rewardPerShare / 1e12 - user.rewardDebt;
            if (pending > 0) {
                safeTransferReward(msg.sender, pending, _pid);
            }
        }
        if (_amount > 0) { // will only be 0 in case of claimReward
            uint256 lpSupply = pool.balance;
            uint256 balanceBefore = pool.lpToken.balanceOf(address(this));
            pool.lpToken.safeTransferFrom(address(msg.sender), address(this), _amount);
            _transferredAmount = pool.lpToken.balanceOf(address(this)) - balanceBefore;
            pool.balance += _transferredAmount;
            uint256 userShares = _transferredAmount;
            // create new shares (and add to the user and the pool's shares) that are the relative part of the user's new deposit
            // out of the pool's total supply, relative to the previous total shares in the pool
            if (pool.totalShares > 0) {
                userShares = pool.totalShares * _transferredAmount / lpSupply;
            }
            user.shares += userShares;
            pool.totalShares += userShares;
        }
        user.rewardDebt = user.shares * pool.rewardPerShare / 1e12;
    }
}